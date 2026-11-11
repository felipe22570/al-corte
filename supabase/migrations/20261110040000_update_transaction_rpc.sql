create function public.update_transaction_with_installments(p_id uuid, p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_original public.transactions%rowtype;
  v_card public.cards%rowtype;
  v_new public.transactions%rowtype;
  v_new_id uuid;
  v_type text := p_payload->>'type';
  v_expected_rate numeric;
  v_current_rate numeric;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_original from public.transactions where id = p_id and user_id = v_user for update;
  if not found then raise exception 'Movimiento no disponible' using errcode = '42501'; end if;
  if v_original.type = 'advance_fee' and v_original.parent_id is not null then
    raise exception 'La comisión se edita desde el avance' using errcode = '22023';
  end if;
  select * into v_card from public.cards where id = (p_payload->>'card_id')::uuid and user_id = v_user and archived_at is null for share;
  if not found then raise exception 'Tarjeta no disponible' using errcode = '42501'; end if;
  v_current_rate := case v_type when 'purchase' then v_card.purchase_rate_ea when 'cash_advance' then v_card.advance_rate_ea else null end;
  v_expected_rate := case when v_original.card_id = v_card.id and v_original.type::text = v_type then coalesce(v_original.rate_ea_applied, v_current_rate) else v_current_rate end;
  if nullif(p_payload->>'rate_ea_applied', '')::numeric is distinct from v_expected_rate then
    raise exception 'La tasa aplicada no corresponde al movimiento' using errcode = '22023';
  end if;

  -- La función de creación valida el plan completo y crea los extractos en la misma transacción.
  -- Su comprobación de tasa usa la tasa vigente; la tasa congelada se valida arriba.
  v_new_id := public.create_transaction_with_installments(jsonb_set(p_payload, '{rate_ea_applied}', coalesce(to_jsonb(v_current_rate), 'null'::jsonb)));
  select * into strict v_new from public.transactions where id = v_new_id and user_id = v_user;
  delete from public.installments where transaction_id = p_id and user_id = v_user;
  delete from public.transactions where parent_id = p_id and user_id = v_user and type = 'advance_fee';
  update public.transactions set card_id = v_new.card_id, statement_id = v_new.statement_id, category_id = v_new.category_id,
    type = v_new.type, date = v_new.date, merchant = v_new.merchant, amount = v_new.amount, currency = v_new.currency,
    fx_rate = v_new.fx_rate, amount_cop = v_new.amount_cop, installments_count = v_new.installments_count,
    interest_free = v_new.interest_free, rate_ea_applied = v_expected_rate, note = v_new.note
    where id = p_id and user_id = v_user;
  update public.installments set transaction_id = p_id where transaction_id = v_new_id and user_id = v_user;
  update public.transactions set parent_id = p_id where parent_id = v_new_id and user_id = v_user;
  delete from public.transactions where id = v_new_id and user_id = v_user;
  if v_original.subscription_id is not null then
    update public.subscriptions set last_charged_amount = (
      select t.amount from public.transactions t where t.subscription_id = v_original.subscription_id and t.user_id = v_user
      order by t.date desc, t.created_at desc, t.id desc limit 1
    ) where id = v_original.subscription_id and user_id = v_user;
  end if;
  return p_id;
end;
$$;
revoke all on function public.update_transaction_with_installments(uuid, jsonb) from public, anon;
grant execute on function public.update_transaction_with_installments(uuid, jsonb) to authenticated;
