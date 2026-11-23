-- Step 42 (F18, D44, D51): alert ingestion. Card aliases, the capture switch and the per-minute request counter.

-- Other last 4 digits of a card (virtual or reissued cards). A 4-digit number belongs to one alias per owner.
create table public.card_aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  card_id uuid not null references public.cards on delete cascade,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  unique (user_id, last4)
);
create index card_aliases_card_idx on public.card_aliases (card_id);

create function public.guard_card_alias() returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.cards where id = new.card_id and user_id = new.user_id) then
    raise exception 'Tarjeta no disponible' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger card_aliases_guard before insert or update on public.card_aliases for each row execute function public.guard_card_alias();

alter table public.card_aliases enable row level security;
revoke all on public.card_aliases from anon, authenticated;
grant select, insert, delete on public.card_aliases to authenticated;
create policy owner_select on public.card_aliases for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.card_aliases for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_delete on public.card_aliases for delete to authenticated using ((select auth.uid()) = user_id);

-- Capture switch (D51: Ajustes only turns capture on or off). Without a row, capture is off.
create table public.capture_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger capture_settings_updated_at before update on public.capture_settings for each row execute function public.set_updated_at();

alter table public.capture_settings enable row level security;
revoke all on public.capture_settings from anon, authenticated;
grant select, insert, update on public.capture_settings to authenticated;
create policy owner_select on public.capture_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.capture_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.capture_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Requests per one-minute window. Vercel invocations share no memory, so the count lives here. Only the ingest route
-- (service key) touches it; sessions have no access.
create table public.ingest_rate_limits (
  user_id uuid not null references auth.users on delete cascade,
  window_start timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  primary key (user_id, window_start)
);
alter table public.ingest_rate_limits enable row level security;
revoke all on public.ingest_rate_limits from anon, authenticated;

-- Counts one request and answers whether it is within the limit. Atomic: concurrent requests never exceed it.
create function public.ingest_rate_hit(p_user_id uuid, p_limit integer) returns boolean
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_window timestamptz := date_trunc('minute', now());
  v_hits integer;
begin
  if p_user_id is null or p_limit is null or p_limit < 1 then raise exception 'Límite inválido' using errcode = '22023'; end if;
  insert into public.ingest_rate_limits (user_id, window_start, hits) values (p_user_id, v_window, 1)
  on conflict (user_id, window_start) do update set hits = public.ingest_rate_limits.hits + 1
  returning hits into v_hits;
  delete from public.ingest_rate_limits where user_id = p_user_id and window_start < v_window - interval '1 day';
  return v_hits <= p_limit;
end;
$$;
revoke all on function public.ingest_rate_hit(uuid, integer) from public, anon, authenticated;
grant execute on function public.ingest_rate_hit(uuid, integer) to service_role;
