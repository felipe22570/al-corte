create function public.create_transaction_with_installments(p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_card public.cards%rowtype;
  v_card_id uuid;
  v_type text := p_payload->>'type';
  v_currency text := p_payload->>'currency';
  v_date date;
  v_amount numeric;
  v_amount_cop numeric;
  v_fx_rate numeric;
  v_count integer;
  v_interest_free boolean;
  v_rate numeric;
  v_first_cutoff date;
  v_cutoff date;
  v_expected_month date;
  v_row jsonb;
  v_index integer := 0;
  v_principal numeric;
  v_interest numeric;
  v_total numeric;
  v_balance numeric;
  v_principal_cop numeric;
  v_interest_cop numeric;
  v_total_cop numeric;
  v_sum_principal_cop numeric := 0;
  v_statement_id uuid;
  v_transaction_id uuid;
  v_category_id uuid;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  v_card_id := (p_payload->>'card_id')::uuid;
  select * into v_card from public.cards where id = v_card_id and user_id = v_user and archived_at is null for share;
  if not found then raise exception 'Tarjeta no disponible' using errcode = '42501'; end if;

  if v_type is null or v_type not in ('purchase', 'cash_advance', 'payment', 'handling_fee', 'interest', 'insurance', 'refund', 'adjustment') then
    raise exception 'Tipo inválido' using errcode = '22023';
  end if;
  if v_currency is null or v_currency not in ('COP', 'USD') then raise exception 'Moneda inválida' using errcode = '22023'; end if;
  v_date := (p_payload->>'date')::date;
  v_amount := (p_payload->>'amount')::numeric;
  v_amount_cop := (p_payload->>'amount_cop')::numeric;
  v_fx_rate := nullif(p_payload->>'fx_rate', '')::numeric;
  v_count := (p_payload->>'installments_count')::integer;
  v_interest_free := (p_payload->>'interest_free')::boolean;
  v_rate := nullif(p_payload->>'rate_ea_applied', '')::numeric;
  v_category_id := nullif(p_payload->>'category_id', '')::uuid;

  if v_date is null or v_amount is null or v_amount_cop is null or v_amount::text in ('NaN','Infinity','-Infinity')
     or v_amount_cop::text in ('NaN','Infinity','-Infinity') or v_amount <= 0 or v_amount_cop <= 0
     or v_amount > 999999999999.99 or v_amount_cop > 999999999999.99
     or v_amount <> round(v_amount, 2) or v_amount_cop <> round(v_amount_cop, 2)
     or v_count is null or v_count not between 1 and 36 or v_interest_free is null then
    raise exception 'Datos del movimiento inválidos' using errcode = '22023';
  end if;
  if v_type not in ('purchase', 'cash_advance') and v_count <> 1 then
    raise exception 'El movimiento no admite cuotas' using errcode = '22023';
  end if;
  if (v_currency = 'COP' and (v_fx_rate is not null or v_amount_cop <> v_amount)) or
     (v_currency = 'USD' and (v_fx_rate is null or v_fx_rate::text in ('NaN','Infinity','-Infinity') or v_fx_rate <= 0 or v_fx_rate > 99999999.9999 or v_fx_rate <> round(v_fx_rate, 4) or v_amount_cop <> round(v_amount * v_fx_rate))) then
    raise exception 'Moneda o TRM inconsistentes' using errcode = '22023';
  end if;
  if (v_type = 'purchase' and v_rate is distinct from v_card.purchase_rate_ea) or
     (v_type = 'cash_advance' and v_rate is distinct from v_card.advance_rate_ea) or
     (v_type not in ('purchase', 'cash_advance') and v_rate is not null) then
    raise exception 'La tasa de la tarjeta cambió. Revisa el movimiento.' using errcode = '22023';
  end if;
  if v_category_id is not null and not exists (select 1 from public.categories where id = v_category_id and user_id = v_user and archived_at is null) then
    raise exception 'Categoría no disponible' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'installments') is distinct from 'array' or
     jsonb_array_length(p_payload->'installments') <> (case when v_count > 1 then v_count else 0 end) then
    raise exception 'Número de cuotas inconsistente' using errcode = '22023';
  end if;

  v_first_cutoff := public.statement_cutoff_for(v_card.cutoff_day, v_date);
  v_balance := v_amount;
  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_index := v_index + 1;
    v_expected_month := (date_trunc('month', v_first_cutoff::timestamp) + make_interval(months => v_index - 1))::date;
    v_cutoff := public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_expected_month)::integer, extract(month from v_expected_month)::integer);
    v_principal := (v_row->>'principal')::numeric;
    v_interest := (v_row->>'interest')::numeric;
    v_total := (v_row->>'total')::numeric;
    v_principal_cop := (v_row->>'principal_cop')::numeric;
    v_interest_cop := (v_row->>'interest_cop')::numeric;
    v_total_cop := (v_row->>'total_cop')::numeric;
    if (v_row->>'number')::integer is distinct from v_index or (v_row->>'cutoff_date')::date is distinct from v_cutoff
       or v_principal is null or v_interest is null or v_total is null or v_principal_cop is null or v_interest_cop is null or v_total_cop is null
       or v_principal < 0 or v_interest < 0 or v_principal_cop < 0 or v_interest_cop < 0
       or v_principal::text in ('NaN','Infinity','-Infinity') or v_interest::text in ('NaN','Infinity','-Infinity')
       or v_principal_cop::text in ('NaN','Infinity','-Infinity') or v_interest_cop::text in ('NaN','Infinity','-Infinity')
       or v_principal <> round(v_principal, 2) or v_interest <> round(v_interest, 2)
       or v_principal_cop <> round(v_principal_cop, 2) or v_interest_cop <> round(v_interest_cop, 2)
       or v_total <> v_principal + v_interest or v_total_cop <> v_principal_cop + v_interest_cop
       or (v_interest_free and v_interest <> 0) then
      raise exception 'Cuota inconsistente' using errcode = '22023';
    end if;
    v_balance := v_balance - v_principal;
    if v_balance < 0 or (v_row->>'balance_after')::numeric is distinct from v_balance then
      raise exception 'Saldo de cuota inconsistente' using errcode = '22023';
    end if;
    if (v_currency = 'COP' and (v_principal_cop <> v_principal or v_interest_cop <> v_interest)) or
       (v_currency = 'USD' and (v_interest_cop <> round(v_interest * v_fx_rate) or v_principal_cop <> (case when v_index = v_count then v_amount_cop - v_sum_principal_cop else round(v_principal * v_fx_rate) end))) then
      raise exception 'Equivalente COP inconsistente' using errcode = '22023';
    end if;
    v_sum_principal_cop := v_sum_principal_cop + v_principal_cop;
  end loop;
  if v_count > 1 and (v_balance <> 0 or v_sum_principal_cop <> v_amount_cop) then
    raise exception 'Capital de cuotas inconsistente' using errcode = '22023';
  end if;

  v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, interest_free, rate_ea_applied, category_id, merchant, note, source)
  values (v_user, v_card_id, v_statement_id, v_type::public.transaction_type, v_date, v_amount, v_currency::public.currency_code, v_fx_rate, v_amount_cop, v_count, v_interest_free, v_rate, v_category_id, nullif(p_payload->>'merchant', ''), nullif(p_payload->>'note', ''), 'manual')
  returning id into v_transaction_id;

  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_statement_id := public.ensure_statement(v_card_id, (v_row->>'cutoff_date')::date);
    insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
    values (v_user, v_transaction_id, v_statement_id, (v_row->>'number')::integer, (v_row->>'principal')::numeric, (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric, (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric);
  end loop;
  if v_type = 'cash_advance' and v_card.advance_fee > 0 then
    v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
    insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, amount_cop, parent_id, source)
    values (v_user, v_card_id, v_statement_id, 'advance_fee', v_date, v_card.advance_fee, 'COP', v_card.advance_fee, v_transaction_id, 'manual');
  end if;
  return v_transaction_id;
end;
$$;
revoke all on function public.create_transaction_with_installments(jsonb) from public, anon;
grant execute on function public.create_transaction_with_installments(jsonb) to authenticated;
