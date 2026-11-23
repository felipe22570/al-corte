-- Step 41 (F18, D46, D47): captured movements waiting for the owner's confirmation. They live apart from
-- `transactions` and no statement, month, total or credit query reads them.
create table public.transaction_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  source text not null default 'email_alert' check (source in ('email_alert')),
  -- Message identifier: the same email never creates two drafts, even after it was confirmed or discarded.
  external_id text not null check (length(external_id) between 1 and 200),
  -- Facts read by rules (R10). The original phrase stays only while the draft is open (D47).
  phrase text check (length(phrase) between 1 and 1000),
  card_id uuid references public.cards on delete set null,
  last4 text check (last4 ~ '^[0-9]{4}$'),
  type public.transaction_type,
  amount numeric(14,2) check (amount > 0),
  currency public.currency_code,
  merchant_raw text check (length(merchant_raw) between 1 and 200),
  occurred_on date,
  occurred_time time,
  statement_cutoff date,
  -- AI suggestions, validated with Zod before saving and again when read; never amount, currency, date or card.
  suggestions jsonb check (suggestions is null or jsonb_typeof(suggestions) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'needs_review', 'unknown_card', 'confirmed', 'discarded')),
  transaction_id uuid references public.transactions on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id),
  constraint transaction_drafts_resolution check ((status in ('confirmed', 'discarded')) = (resolved_at is not null)),
  -- D47: once resolved only the identifier, the state, the linked movement and the dates remain.
  constraint transaction_drafts_resolved_empty check (status not in ('confirmed', 'discarded') or (
    phrase is null and suggestions is null and card_id is null and last4 is null and type is null and amount is null
    and currency is null and merchant_raw is null and occurred_on is null and occurred_time is null and statement_cutoff is null)),
  constraint transaction_drafts_link check (transaction_id is null or status = 'confirmed'),
  -- An open draft keeps the phrase; a pending one has every fact the form needs.
  constraint transaction_drafts_open check (status in ('confirmed', 'discarded') or phrase is not null),
  constraint transaction_drafts_pending check (status <> 'pending' or (
    card_id is not null and type is not null and amount is not null and currency is not null and occurred_on is not null)),
  constraint transaction_drafts_unknown_card check (status <> 'unknown_card' or card_id is null)
);

create unique index transaction_drafts_transaction_unique on public.transaction_drafts (transaction_id) where transaction_id is not null;
create index transaction_drafts_open_idx on public.transaction_drafts (user_id, created_at) where status in ('pending', 'needs_review', 'unknown_card');
create trigger transaction_drafts_updated_at before update on public.transaction_drafts for each row execute function public.set_updated_at();

-- The card belongs to the draft's owner, and a resolved draft never reopens (only its movement may be deleted).
create function public.guard_transaction_draft() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.card_id is not null and not exists (select 1 from public.cards where id = new.card_id and user_id = new.user_id) then
    raise exception 'Tarjeta no disponible' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.user_id <> old.user_id or new.external_id <> old.external_id or new.source <> old.source then
      raise exception 'Borrador inválido' using errcode = '22023';
    end if;
    if old.status in ('confirmed', 'discarded')
       and (new.status, new.resolved_at) is distinct from (old.status, old.resolved_at)
       or (old.status in ('confirmed', 'discarded') and new.transaction_id is distinct from old.transaction_id and new.transaction_id is not null) then
      raise exception 'El borrador ya se resolvió' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;
create trigger transaction_drafts_guard before insert or update on public.transaction_drafts for each row execute function public.guard_transaction_draft();

-- Owners read and resolve their drafts. Only the ingest route (service key, step 42) inserts them; nobody deletes them,
-- so a discarded message is never captured again.
alter table public.transaction_drafts enable row level security;
revoke all on public.transaction_drafts from anon, authenticated;
grant select, update on public.transaction_drafts to authenticated;
create policy owner_select on public.transaction_drafts for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_update on public.transaction_drafts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Resolves an open draft of the session owner, keeping only what D47 allows.
create function private.resolve_transaction_draft(p_draft_id uuid, p_status text, p_transaction_id uuid) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  update public.transaction_drafts set
    status = p_status, transaction_id = p_transaction_id, resolved_at = now(),
    phrase = null, suggestions = null, card_id = null, last4 = null, type = null, amount = null, currency = null,
    merchant_raw = null, occurred_on = null, occurred_time = null, statement_cutoff = null
  where id = p_draft_id;
end;
$$;
revoke all on function private.resolve_transaction_draft(uuid, text, uuid) from public, anon;
grant execute on function private.resolve_transaction_draft(uuid, text, uuid) to authenticated;

create function private.lock_open_draft(p_draft_id uuid) returns public.transaction_drafts
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_draft public.transaction_drafts%rowtype;
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_draft from public.transaction_drafts
  where id = p_draft_id and user_id = auth.uid() and status in ('pending', 'needs_review', 'unknown_card') for update;
  if not found then raise exception 'Borrador no disponible' using errcode = 'P0002'; end if;
  return v_draft;
end;
$$;
revoke all on function private.lock_open_draft(uuid) from public, anon;
grant execute on function private.lock_open_draft(uuid) to authenticated;

-- Confirm: creates the real movement with the same RPC as the expense form, marks it as captured by email and resolves
-- the draft, all in one transaction. The owner may have corrected any field in the form.
create function public.confirm_transaction_draft(p_draft_id uuid, p_payload jsonb) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_transaction_id uuid;
begin
  perform private.lock_open_draft(p_draft_id);
  v_transaction_id := public.create_transaction_with_installments(p_payload);
  update public.transactions set source = 'email' where id = v_transaction_id;
  perform private.resolve_transaction_draft(p_draft_id, 'confirmed', v_transaction_id);
  return v_transaction_id;
end;
$$;

-- "Es el mismo": links the draft to a movement already registered with the same card, amount, currency and date,
-- without changing that movement.
create function public.link_transaction_draft(p_draft_id uuid, p_transaction_id uuid) returns void
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_draft public.transaction_drafts%rowtype;
begin
  v_draft := private.lock_open_draft(p_draft_id);
  if not exists (
    select 1 from public.transactions t
    where t.id = p_transaction_id and t.user_id = auth.uid() and t.card_id = v_draft.card_id and t.amount = v_draft.amount
      and t.currency = v_draft.currency and t.date = v_draft.occurred_on
  ) then
    raise exception 'El movimiento no coincide con el borrador' using errcode = '22023';
  end if;
  if exists (select 1 from public.transaction_drafts where transaction_id = p_transaction_id) then
    raise exception 'El movimiento ya está enlazado a otro borrador' using errcode = '23505';
  end if;
  perform private.resolve_transaction_draft(p_draft_id, 'confirmed', p_transaction_id);
end;
$$;

create function public.discard_transaction_draft(p_draft_id uuid) returns void
language plpgsql volatile security invoker set search_path = '' as $$
begin
  perform private.lock_open_draft(p_draft_id);
  perform private.resolve_transaction_draft(p_draft_id, 'discarded', null);
end;
$$;

revoke all on function public.confirm_transaction_draft(uuid, jsonb) from public, anon;
revoke all on function public.link_transaction_draft(uuid, uuid) from public, anon;
revoke all on function public.discard_transaction_draft(uuid) from public, anon;
grant execute on function public.confirm_transaction_draft(uuid, jsonb) to authenticated;
grant execute on function public.link_transaction_draft(uuid, uuid) to authenticated;
grant execute on function public.discard_transaction_draft(uuid) to authenticated;
