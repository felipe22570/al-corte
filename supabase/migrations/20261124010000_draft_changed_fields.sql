-- Step 45 (H12 validation): which fields the owner corrected when confirming a captured draft. Field names only, never
-- values, so D47 still holds: the email data is gone once the draft is resolved. Null means unknown (a draft confirmed
-- before this migration, or linked with "Es el mismo"); an empty array means confirmed without changes.
alter table public.transaction_drafts add column changed_fields text[];
alter table public.transaction_drafts add constraint transaction_drafts_changed_fields check (
  changed_fields is null or (
    status = 'confirmed'
    and changed_fields <@ array['card', 'type', 'date', 'amount', 'currency', 'merchant', 'category', 'installments', 'international']::text[]
  )
);

drop function public.confirm_transaction_draft(uuid, jsonb);

-- Confirm: creates the real movement with the same RPC as the expense form, marks it as captured by email, resolves the
-- draft and records the names of the corrected fields, all in one transaction.
create function public.confirm_transaction_draft(p_draft_id uuid, p_payload jsonb, p_changed_fields text[] default null) returns uuid
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_transaction_id uuid;
begin
  perform private.lock_open_draft(p_draft_id);
  v_transaction_id := public.create_transaction_with_installments(p_payload);
  update public.transactions set source = 'email' where id = v_transaction_id;
  perform private.resolve_transaction_draft(p_draft_id, 'confirmed', v_transaction_id);
  if p_changed_fields is not null then
    update public.transaction_drafts
    set changed_fields = (select coalesce(array_agg(distinct field order by field), '{}') from unnest(p_changed_fields) as field)
    where id = p_draft_id;
  end if;
  return v_transaction_id;
end;
$$;

revoke all on function public.confirm_transaction_draft(uuid, jsonb, text[]) from public, anon;
grant execute on function public.confirm_transaction_draft(uuid, jsonb, text[]) to authenticated;
