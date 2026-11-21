-- Step 35 (H10): plans shortened by the bank's rounding (R2). Small amounts in many installments keep the rounded
-- installment and end earlier, as the bank bills them (US$ 2,79 a 36 cuotas: 34 de US$ 0,08 y la última de US$ 0,07).

alter table public.transactions
  drop constraint transactions_original_installments_count_check,
  add constraint transactions_original_installments_count_check check (
    original_installments_count is null
    or (original_installments_count between 2 and 36 and original_installments_count <> installments_count
        and (prior_installments > 0 or original_installments_count > installments_count))
  );

-- A deferred subscription only needs an installment that does not round to zero.
alter table public.subscriptions
  drop constraint subscriptions_installments_amount_check,
  add constraint subscriptions_installments_amount_check check (installments_count = 1 or round(amount / installments_count, 2) > 0);

-- Installment plan in SQL, the same as buildInstallmentPlan (parity fixtures shared with Vitest) -----------------

create or replace function private.build_installment_rows(
  p_amount numeric, p_count integer, p_rate_ea numeric, p_method text, p_interest_free boolean, p_interest_mode text,
  p_currency text, p_fx_rate numeric, p_cutoff_day integer, p_date date
) returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  v_rate numeric := 0;
  v_payment numeric;
  v_regular numeric;
  v_balance numeric := p_amount;
  v_amount_cop numeric;
  v_sum_principal_cop numeric := 0;
  v_first_cutoff date;
  v_month date;
  v_principal numeric;
  v_interest numeric;
  v_principal_cop numeric;
  v_interest_cop numeric;
  v_rows jsonb := '[]'::jsonb;
  v_count integer;
begin
  if p_amount is null or p_amount <= 0 or p_count is null or p_count not between 1 and 36 or p_rate_ea is null or p_rate_ea < 0
     or p_method not in ('fixed_principal', 'french') or p_currency not in ('COP', 'USD')
     or (p_currency = 'USD' and (p_fx_rate is null or p_fx_rate <= 0)) or (p_currency = 'COP' and p_fx_rate is not null) then
    raise exception 'Plan de cuotas inválido' using errcode = '22023';
  end if;
  -- One installment, interest-free and on-balance cards (D32) bill no interest inside the installments.
  if p_count > 1 and not p_interest_free and p_interest_mode is distinct from 'on_balance' and p_rate_ea > 0 then
    v_rate := round(power((1 + p_rate_ea)::numeric(60,40), 1::numeric(60,40) / 12) - 1, 40);
  end if;
  v_amount_cop := case when p_currency = 'COP' then p_amount else round(p_amount * p_fx_rate, 2) end;
  if p_method = 'french' and v_rate > 0 then
    v_payment := round(p_amount * v_rate / (1 - power(1 + v_rate, -p_count)), 2);
  end if;
  v_regular := round(p_amount / p_count, 2);
  -- R2 with the bank's rounding: when the rounded fixed principal leaves nothing for the last installment, the bank keeps
  -- the installment and the plan ends earlier, the last one for the rest. An installment rounded to zero is impossible.
  v_count := p_count;
  if v_payment is null and v_regular = 0 then
    raise exception 'El valor es muy pequeño para esa cantidad de cuotas.' using errcode = '22023';
  end if;
  if v_payment is null and v_regular * (p_count - 1) >= p_amount then
    v_count := ceil(p_amount / v_regular)::integer;
  end if;
  v_first_cutoff := public.statement_cutoff_for(p_cutoff_day, p_date);
  for v_index in 1..v_count loop
    v_interest := round(v_balance * v_rate, 2);
    v_principal := case when v_index = v_count then v_balance when v_payment is not null then v_payment - v_interest else v_regular end;
    v_balance := v_balance - v_principal;
    if v_principal < 0 or v_balance < 0 then
      raise exception 'El valor es muy pequeño para esa cantidad de cuotas.' using errcode = '22023';
    end if;
    if p_currency = 'COP' then
      v_principal_cop := v_principal;
      v_interest_cop := v_interest;
    else
      v_principal_cop := case when v_index = v_count then v_amount_cop - v_sum_principal_cop else round(v_principal * p_fx_rate, 2) end;
      v_interest_cop := round(v_interest * p_fx_rate, 2);
    end if;
    v_sum_principal_cop := v_sum_principal_cop + v_principal_cop;
    v_month := (date_trunc('month', v_first_cutoff::timestamp) + make_interval(months => v_index - 1))::date;
    v_rows := v_rows || jsonb_build_object(
      'number', v_index,
      'cutoff_date', public.cutoff_date_for_month(p_cutoff_day, extract(year from v_month)::integer, extract(month from v_month)::integer),
      'before_tracking', false,
      'principal', v_principal, 'interest', v_interest, 'total', v_principal + v_interest, 'balance_after', v_balance,
      'principal_cop', v_principal_cop, 'interest_cop', v_interest_cop, 'total_cop', v_principal_cop + v_interest_cop
    );
  end loop;
  return v_rows;
end;
$$;
revoke all on function private.build_installment_rows(numeric, integer, numeric, text, boolean, text, text, numeric, integer, date) from public, anon, authenticated;

-- Subscription charges: the effective plan and the original N of a shortened plan ------------------------------

create or replace function public.generate_subscription_charge_on(p_subscription_id uuid, p_date date)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_card public.cards%rowtype;
  v_rate numeric;
  v_amount_cop numeric;
  v_cutoff date;
  v_statement uuid;
  v_created uuid;
  v_month_end date;
  v_rows jsonb := '[]'::jsonb;
  v_row jsonb;
begin
  select * into v_subscription from public.subscriptions where id = p_subscription_id for update;
  if not found or v_subscription.status <> 'active' then return 0; end if;
  select * into v_card from public.cards where id = v_subscription.card_id and user_id = v_subscription.user_id and archived_at is null;
  if not found then return 0; end if;
  if p_date < v_subscription.start_date or (v_subscription.trial_ends_at is not null and p_date < v_subscription.trial_ends_at) then return 0; end if;
  if v_subscription.frequency = 'yearly' and extract(month from p_date) <> extract(month from v_subscription.start_date) then return 0; end if;
  v_month_end := (date_trunc('month', p_date::timestamp) + interval '1 month - 1 day')::date;
  if extract(day from p_date)::integer <> least(v_subscription.billing_day, extract(day from v_month_end)::integer) then return 0; end if;
  if exists (select 1 from public.transactions where subscription_id = v_subscription.id and date = p_date) then return 0; end if;
  if v_subscription.currency = 'USD' then
    select usd_cop into v_rate from public.fx_rates order by date desc limit 1;
    if v_rate is null then
      select fx_rate into v_rate from public.transactions where user_id = v_subscription.user_id and currency = 'USD' and fx_rate is not null order by date desc, created_at desc limit 1;
    end if;
    if v_rate is null then return 0; end if;
    v_amount_cop := round(v_subscription.amount * v_rate, 2);
    if v_amount_cop <= 0 or v_amount_cop > 999999999999.99 then return 0; end if;
  else
    v_amount_cop := v_subscription.amount;
  end if;
  if v_subscription.installments_count > 1 then
    begin
      v_rows := private.build_installment_rows(v_subscription.amount, v_subscription.installments_count, v_card.purchase_rate_ea,
        v_card.amortization_method::text, false, v_card.interest_mode::text, v_subscription.currency::text,
        case when v_subscription.currency = 'USD' then v_rate end, v_card.cutoff_day, p_date);
    exception when invalid_parameter_value then
      -- An impossible plan never aborts the daily run for the other subscriptions.
      return 0;
    end;
  end if;
  v_cutoff := public.statement_cutoff_for(v_card.cutoff_day, p_date);
  v_statement := public.ensure_statement(v_card.id, v_cutoff);
  insert into public.transactions (user_id,card_id,statement_id,category_id,type,date,merchant,amount,currency,fx_rate,amount_cop,installments_count,rate_ea_applied,subscription_id,source,original_installments_count)
  values (v_subscription.user_id,v_card.id,v_statement,v_subscription.category_id,'purchase',p_date,v_subscription.name,v_subscription.amount,v_subscription.currency,v_rate,v_amount_cop,
    greatest(jsonb_array_length(v_rows), 1), case when v_subscription.installments_count > 1 then v_card.purchase_rate_ea end, v_subscription.id,'subscription',
    case when v_subscription.installments_count > 1 and jsonb_array_length(v_rows) <> v_subscription.installments_count then v_subscription.installments_count end)
  on conflict (subscription_id,date) where subscription_id is not null do nothing returning id into v_created;
  if v_created is null then return 0; end if;
  for v_row in select value from jsonb_array_elements(v_rows) loop
    v_statement := public.ensure_statement(v_card.id, (v_row->>'cutoff_date')::date);
    insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
    values (v_subscription.user_id, v_created, v_statement, (v_row->>'number')::integer, (v_row->>'principal')::numeric, (v_row->>'interest')::numeric,
      (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric, (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric);
  end loop;
  if not exists (select 1 from public.transactions where subscription_id = v_subscription.id and date > p_date) then
    update public.subscriptions set last_charged_amount = v_subscription.amount where id = v_subscription.id;
  end if;
  return 1;
end;
$$;
revoke all on function public.generate_subscription_charge_on(uuid,date) from public, anon, authenticated;

-- Registration RPC: same as the statement import, accepting a shortened plan with its original N -------------------

create or replace function public.create_transaction_with_installments(p_payload jsonb)
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
  v_prior integer;
  v_prior_paid numeric;
  v_original integer;
  v_tracked_from date;
  v_first_cutoff date;
  v_cutoff date;
  v_expected_month date;
  v_row jsonb;
  v_index integer := 0;
  v_before boolean;
  v_principal numeric;
  v_interest numeric;
  v_total numeric;
  v_balance numeric;
  v_principal_cop numeric;
  v_interest_cop numeric;
  v_total_cop numeric;
  v_sum_principal_cop numeric := 0;
  v_prior_sum numeric := 0;
  v_statement_id uuid;
  v_transaction_id uuid;
  v_category_id uuid;
  v_is_international boolean;
  v_fee numeric;
  v_override date;
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
  v_prior := coalesce(nullif(p_payload->>'prior_installments', '')::integer, 0);
  v_prior_paid := coalesce(nullif(p_payload->>'prior_principal_paid', '')::numeric, 0);
  v_original := nullif(p_payload->>'original_installments_count', '')::integer;
  v_tracked_from := nullif(p_payload->>'tracked_from_cutoff', '')::date;
  -- R9: classification for Bancolombia's prepayment order; dollar purchases and advances are international by default.
  v_is_international := coalesce(nullif(p_payload->>'is_international', '')::boolean, v_currency = 'USD' and v_type in ('purchase', 'cash_advance'));

  if v_date is null or v_amount is null or v_amount_cop is null or v_amount::text in ('NaN','Infinity','-Infinity')
     or v_amount_cop::text in ('NaN','Infinity','-Infinity') or v_amount <= 0 or v_amount_cop <= 0
     or v_amount > 999999999999.99 or v_amount_cop > 999999999999.99
     or v_amount <> round(v_amount, 2) or v_amount_cop <> round(v_amount_cop, 2)
     or v_count is null or v_count not between 1 and 72 or v_interest_free is null then
    raise exception 'Datos del movimiento inválidos' using errcode = '22023';
  end if;
  if v_type not in ('purchase', 'cash_advance') and v_count <> 1 then
    raise exception 'El movimiento no admite cuotas' using errcode = '22023';
  end if;
  -- D41: each advance keeps its own fee; the card's is only the default. An in-progress advance already paid it.
  v_fee := coalesce(nullif(p_payload->>'advance_fee', '')::numeric, case when v_type = 'cash_advance' and v_prior = 0 then v_card.advance_fee else 0 end);
  if v_fee::text in ('NaN', 'Infinity', '-Infinity') or v_fee < 0 or v_fee > 999999999999.99 or v_fee <> round(v_fee, 2)
     or (v_fee > 0 and (v_type <> 'cash_advance' or v_prior > 0)) then
    raise exception 'Comisión de avance inválida' using errcode = '22023';
  end if;
  if v_type not in ('purchase', 'cash_advance') and v_is_international then
    raise exception 'Solo las compras y los avances pueden ser internacionales' using errcode = '22023';
  end if;
  -- D15: new plans up to 36 installments. D50: effective in-progress plans up to 72, original N up to 36.
  if v_prior = 0 then
    -- A plan shortened by rounding keeps its original N (R2): more than the effective plan, up to 36.
    if v_count > 36 or v_prior_paid <> 0 or v_tracked_from is not null
       or (v_original is not null and (v_original not between 2 and 36 or v_original <= v_count)) then
      raise exception 'Datos del movimiento inválidos' using errcode = '22023';
    end if;
  else
    if v_type not in ('purchase', 'cash_advance') or v_prior < 1 or v_prior >= v_count
       or v_prior_paid::text in ('NaN','Infinity','-Infinity') or v_prior_paid < 0 or v_prior_paid >= v_amount
       or v_prior_paid <> round(v_prior_paid, 2)
       or (v_original is null and v_count > 36)
       or (v_original is not null and (v_original not between 2 and 36 or v_original = v_count))
       or v_tracked_from is null then
      raise exception 'Compra en curso inválida' using errcode = '22023';
    end if;
    -- Installment k sits on a real cutoff of the card, not before the purchase and not after the open statement.
    if v_tracked_from <> public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_tracked_from)::integer, extract(month from v_tracked_from)::integer)
       or v_tracked_from < public.statement_cutoff_for(v_card.cutoff_day, v_date)
       or v_tracked_from > public.statement_cutoff_for(v_card.cutoff_day, (now() at time zone 'America/Bogota')::date) then
      raise exception 'El corte de la cuota actual no es válido' using errcode = '22023';
    end if;
  end if;
  if (v_currency = 'COP' and (v_fx_rate is not null or v_amount_cop <> v_amount)) or
     (v_currency = 'USD' and (v_fx_rate is null or v_fx_rate::text in ('NaN','Infinity','-Infinity') or v_fx_rate <= 0 or v_fx_rate > 99999999.9999 or v_fx_rate <> round(v_fx_rate, 4) or v_amount_cop <> round(v_amount * v_fx_rate, 2))) then
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

  -- With prior installments the movement belongs to the statement of installment k (D49), not to R1 by its date.
  v_first_cutoff := case when v_prior > 0 then v_tracked_from else public.statement_cutoff_for(v_card.cutoff_day, v_date) end;
  -- D30: a single-installment charge on the border of a variable bank cutoff keeps the statement the bank billed it in,
  -- the previous or the next one by R1.
  v_override := nullif(p_payload->>'statement_cutoff_override', '')::date;
  if v_override is not null then
    if v_count <> 1 or v_prior > 0
       or v_override <> public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_override)::integer, extract(month from v_override)::integer)
       or v_override not in (
         v_first_cutoff,
         public.statement_cutoff_for(v_card.cutoff_day, v_first_cutoff + 1),
         public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_first_cutoff - interval '1 month')::integer, extract(month from v_first_cutoff - interval '1 month')::integer)
       ) then
      raise exception 'Extracto forzado inválido' using errcode = '22023';
    end if;
    v_first_cutoff := v_override;
  end if;
  v_balance := v_amount;
  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_index := v_index + 1;
    v_before := coalesce((v_row->>'before_tracking')::boolean, false);
    v_principal := (v_row->>'principal')::numeric;
    v_interest := (v_row->>'interest')::numeric;
    v_total := (v_row->>'total')::numeric;
    v_principal_cop := (v_row->>'principal_cop')::numeric;
    v_interest_cop := (v_row->>'interest_cop')::numeric;
    v_total_cop := (v_row->>'total_cop')::numeric;
    if v_index <= v_prior then
      if not v_before or (v_row->>'cutoff_date') is not null or v_interest is distinct from 0 or v_interest_cop is distinct from 0 then
        raise exception 'Cuota previa inconsistente' using errcode = '22023';
      end if;
      v_prior_sum := v_prior_sum + v_principal;
    else
      v_expected_month := (date_trunc('month', v_first_cutoff::timestamp) + make_interval(months => v_index - v_prior - 1))::date;
      v_cutoff := public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_expected_month)::integer, extract(month from v_expected_month)::integer);
      if v_before or (v_row->>'cutoff_date')::date is distinct from v_cutoff then
        raise exception 'Cuota inconsistente' using errcode = '22023';
      end if;
    end if;
    if (v_row->>'number')::integer is distinct from v_index
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
    -- D32: on-balance cards bill interest once per statement, so installments are principal only.
    if v_card.interest_mode = 'on_balance' and (v_interest <> 0 or v_interest_cop <> 0) then
      raise exception 'Las cuotas de esta tarjeta son solo de capital' using errcode = '22023';
    end if;
    v_balance := v_balance - v_principal;
    if v_balance < 0 or (v_row->>'balance_after')::numeric is distinct from v_balance then
      raise exception 'Saldo de cuota inconsistente' using errcode = '22023';
    end if;
    if (v_currency = 'COP' and (v_principal_cop <> v_principal or v_interest_cop <> v_interest)) or
       (v_currency = 'USD' and (v_interest_cop <> round(v_interest * v_fx_rate, 2) or v_principal_cop <> (case when v_index = v_count then v_amount_cop - v_sum_principal_cop else round(v_principal * v_fx_rate, 2) end))) then
      raise exception 'Equivalente COP inconsistente' using errcode = '22023';
    end if;
    v_sum_principal_cop := v_sum_principal_cop + v_principal_cop;
  end loop;
  if v_count > 1 and (v_balance <> 0 or v_sum_principal_cop <> v_amount_cop) then
    raise exception 'Capital de cuotas inconsistente' using errcode = '22023';
  end if;
  if v_prior_sum <> v_prior_paid then
    raise exception 'Capital previo inconsistente' using errcode = '22023';
  end if;

  -- No statements are created for cutoffs before installment k (no old handling fees, D1).
  v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, interest_free, rate_ea_applied, category_id, merchant, note, source, prior_installments, prior_principal_paid, original_installments_count, is_international, statement_override)
  values (v_user, v_card_id, v_statement_id, v_type::public.transaction_type, v_date, v_amount, v_currency::public.currency_code, v_fx_rate, v_amount_cop, v_count, v_interest_free, v_rate, v_category_id, nullif(p_payload->>'merchant', ''), nullif(p_payload->>'note', ''), 'manual', v_prior, v_prior_paid, v_original, v_is_international, v_override is not null and v_override <> public.statement_cutoff_for(v_card.cutoff_day, v_date))
  returning id into v_transaction_id;

  v_index := 0;
  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_index := v_index + 1;
    v_statement_id := case when v_index <= v_prior then null else public.ensure_statement(v_card_id, (v_row->>'cutoff_date')::date) end;
    insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop, before_tracking)
    values (v_user, v_transaction_id, v_statement_id, (v_row->>'number')::integer, (v_row->>'principal')::numeric, (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric, (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric, v_index <= v_prior);
  end loop;
  -- An in-progress advance already paid its fee before tracking.
  if v_fee > 0 then
    v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
    insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, amount_cop, parent_id, source)
    values (v_user, v_card_id, v_statement_id, 'advance_fee', v_date, v_fee, 'COP', v_fee, v_transaction_id, 'manual');
  end if;
  return v_transaction_id;
end;
$$;
revoke all on function public.create_transaction_with_installments(jsonb) from public, anon;
grant execute on function public.create_transaction_with_installments(jsonb) to authenticated;
