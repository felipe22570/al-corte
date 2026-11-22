-- Step 39 (H11, F23, D52, D56): dollar payments made with pesos and the used credit with the debt in dollars at the TRM.

-- D56: the pesos the bank actually debited for a dollar payment, kept exactly as amount_cop.
alter table public.transactions
  add column cop_debited boolean not null default false,
  add constraint transactions_cop_debited_check check (not cop_debited or (type = 'payment' and currency = 'USD'));
comment on column public.transactions.cop_debited is 'Dollar payment whose amount_cop is the exact pesos debited (D56); its rate is derived from them.';

create or replace function public.register_payment(p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_card public.cards%rowtype;
  v_paid public.statements%rowtype;
  v_target public.transactions%rowtype;
  v_currency text := p_payload->>'currency';
  v_kind text := p_payload->>'kind';
  v_date date := nullif(p_payload->>'date', '')::date;
  v_amount numeric := nullif(p_payload->>'amount', '')::numeric;
  v_amount_cop numeric := nullif(p_payload->>'amount_cop', '')::numeric;
  v_fx_rate numeric := nullif(p_payload->>'fx_rate', '')::numeric;
  v_cop_debited boolean := coalesce(nullif(p_payload->>'cop_debited', '')::boolean, false);
  v_payment_id uuid;
  v_prepayment jsonb;
  v_row jsonb;
  v_prepaid_total numeric := 0;
  v_value numeric;
  v_value_cop numeric;
  v_prepaid numeric;
  v_prepaid_cop numeric;
  v_kept numeric;
  v_kept_cop numeric;
  v_first_future integer;
  v_future_count integer;
  v_snapshot jsonb;
  v_rows jsonb;
  v_rows_count integer;
  v_pending numeric;
  v_balance numeric;
  v_index integer;
  v_principal numeric;
  v_interest numeric;
  v_principal_cop numeric;
  v_interest_cop numeric;
  v_sum_cop numeric;
  v_rate_free boolean;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_card from public.cards where id = nullif(p_payload->>'card_id', '')::uuid and user_id = v_user for share;
  if not found then raise exception 'Tarjeta no disponible' using errcode = '42501'; end if;
  select * into v_paid from public.statements where id = nullif(p_payload->>'statement_id', '')::uuid and user_id = v_user and card_id = v_card.id;
  if not found then raise exception 'Extracto no disponible' using errcode = '42501'; end if;

  if v_kind is null or v_kind not in ('minimum', 'total', 'other') or v_currency is null or v_currency not in ('COP', 'USD') then
    raise exception 'Datos del pago inválidos' using errcode = '22023';
  end if;
  if v_date is null or v_date <= v_paid.cutoff_date or v_date > (now() at time zone 'America/Bogota')::date then
    raise exception 'Fecha de pago inválida' using errcode = '22023';
  end if;
  if v_amount is null or v_amount_cop is null or v_amount::text in ('NaN', 'Infinity', '-Infinity') or v_amount_cop::text in ('NaN', 'Infinity', '-Infinity')
     or v_amount <= 0 or v_amount > 999999999999.99 or v_amount <> round(v_amount, 2) or v_amount_cop <= 0 or v_amount_cop > 999999999999.99 then
    raise exception 'Datos del pago inválidos' using errcode = '22023';
  end if;
  if (v_currency = 'COP' and (v_fx_rate is not null or v_amount_cop <> v_amount)) or
     (v_currency = 'USD' and (v_fx_rate is null or v_fx_rate::text in ('NaN', 'Infinity', '-Infinity') or v_fx_rate <= 0 or v_fx_rate > 99999999.9999
       or v_fx_rate <> round(v_fx_rate, 4) or v_amount_cop <> round(v_amount_cop, 2)
       -- D56: pesos actually debited keep their exact value; the rate derived from them is rounded to 4 decimals, so the
       -- product may differ by up to amount × 0.00005. Without pesos debited, the TRM of D4 gives the exact equivalent.
       or (v_cop_debited and abs(v_amount_cop - v_amount * v_fx_rate) > v_amount * 0.00005)
       or (not v_cop_debited and v_amount_cop <> round(v_amount * v_fx_rate, 2)))) then
    raise exception 'Moneda o TRM inconsistentes' using errcode = '22023';
  end if;
  if v_cop_debited and v_currency <> 'USD' then raise exception 'Moneda o TRM inconsistentes' using errcode = '22023'; end if;
  if jsonb_typeof(p_payload->'prepayments') is distinct from 'array' then raise exception 'Datos del pago inválidos' using errcode = '22023'; end if;

  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, note, source, paid_statement_id, payment_kind, is_international, cop_debited)
  values (v_user, v_card.id, public.ensure_statement(v_card.id, public.statement_cutoff_for(v_card.cutoff_day, v_date)), 'payment', v_date, v_amount,
    v_currency::public.currency_code, v_fx_rate, v_amount_cop, 1, nullif(p_payload->>'note', ''), 'manual', v_paid.id, v_kind::public.payment_kind, false, v_cop_debited)
  returning id into v_payment_id;

  for v_prepayment in select value from jsonb_array_elements(p_payload->'prepayments') loop
    v_value := nullif(v_prepayment->>'amount', '')::numeric;
    v_value_cop := nullif(v_prepayment->>'amount_cop', '')::numeric;
    if v_value is null or v_value_cop is null or v_value::text in ('NaN', 'Infinity', '-Infinity') or v_value_cop::text in ('NaN', 'Infinity', '-Infinity')
       or v_value <= 0 or v_value <> round(v_value, 2) or v_value_cop < 0 or v_value_cop <> round(v_value_cop, 2)
       or coalesce(v_prepayment->>'effect', '') not in ('reduce_term', 'reduce_installment') then
      raise exception 'Abono inválido' using errcode = '22023';
    end if;
    -- D33: a payment only applies to balances of its card and currency.
    select * into v_target from public.transactions
    where id = nullif(v_prepayment->>'transaction_id', '')::uuid and user_id = v_user and card_id = v_card.id and currency = v_currency::public.currency_code
      and type in ('purchase', 'cash_advance', 'advance_fee', 'adjustment')
    for update;
    if not found then raise exception 'La compra del abono no está disponible' using errcode = '22023'; end if;
    v_prepaid_total := v_prepaid_total + v_value;
    select coalesce(sum(amount), 0), coalesce(sum(amount_cop), 0) into v_prepaid, v_prepaid_cop from public.principal_prepayments where transaction_id = v_target.id;

    if v_target.installments_count = 1 then
      -- A single-installment charge receives prepayments only while its statement has not been cut.
      if v_prepayment->'installments' is not null and jsonb_typeof(v_prepayment->'installments') <> 'null'
         or nullif(v_prepayment->>'replaced_from_number', '') is not null
         or (select cutoff_date from public.statements where id = v_target.statement_id) < v_date then
        raise exception 'Abono inválido' using errcode = '22023';
      end if;
      v_pending := v_target.amount - v_prepaid;
      if v_value > v_pending or v_value_cop <> (case when v_currency = 'COP' then v_value when v_value = v_pending then v_target.amount_cop - v_prepaid_cop else round(v_value * v_target.fx_rate, 2) end) then
        raise exception 'Abono inconsistente' using errcode = '22023';
      end if;
      insert into public.principal_prepayments (user_id, payment_id, transaction_id, amount, amount_cop, effect, assumed)
      values (v_user, v_payment_id, v_target.id, v_value, v_value_cop, (v_prepayment->>'effect')::public.prepayment_effect, coalesce((v_prepayment->>'assumed')::boolean, false));
      continue;
    end if;

    -- Billed rows (before tracking or cut before the payment date) never change; the rest are rebuilt.
    select min(i.number) into v_first_future from public.installments i join public.statements s on s.id = i.statement_id
    where i.transaction_id = v_target.id and not i.before_tracking and s.cutoff_date >= v_date;
    select coalesce(sum(principal), 0), coalesce(sum(principal_cop), 0) into v_kept, v_kept_cop
    from public.installments where transaction_id = v_target.id and number < coalesce(v_first_future, 73);
    v_pending := v_target.amount - v_kept - v_prepaid;
    if v_first_future is null or v_value > v_pending or nullif(v_prepayment->>'replaced_from_number', '')::integer is distinct from v_first_future then
      raise exception 'Abono inconsistente' using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object('number', i.number, 'cutoff_date', s.cutoff_date, 'principal', i.principal, 'interest', i.interest, 'total', i.total,
      'balance_after', i.balance_after, 'principal_cop', i.principal_cop, 'interest_cop', i.interest_cop, 'total_cop', i.total_cop) order by i.number), count(*)
    into v_snapshot, v_future_count
    from public.installments i join public.statements s on s.id = i.statement_id
    where i.transaction_id = v_target.id and i.number >= v_first_future;

    v_rows := coalesce(v_prepayment->'installments', '[]'::jsonb);
    if jsonb_typeof(v_rows) <> 'array' then raise exception 'Abono inválido' using errcode = '22023'; end if;
    v_rows_count := jsonb_array_length(v_rows);
    -- Rebuilt plans are never longer and stay in the same statements (reduce_term and reduce_installment).
    if v_rows_count > v_future_count or (v_rows_count = 0 and v_pending <> v_value) then
      raise exception 'Cuotas del abono inconsistentes' using errcode = '22023';
    end if;
    if v_currency = 'COP' and v_value_cop <> v_value
       or v_currency = 'USD' and v_value_cop <> (case when v_rows_count = 0 then v_target.amount_cop - v_kept_cop - v_prepaid_cop else round(v_value * v_target.fx_rate, 2) end) then
      raise exception 'Equivalente COP del abono inconsistente' using errcode = '22023';
    end if;
    v_rate_free := v_target.interest_free or v_card.interest_mode = 'on_balance';
    v_balance := v_pending - v_value;
    v_sum_cop := v_kept_cop + v_prepaid_cop + v_value_cop;
    v_index := 0;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      v_index := v_index + 1;
      v_principal := (v_row->>'principal')::numeric;
      v_interest := (v_row->>'interest')::numeric;
      v_principal_cop := (v_row->>'principal_cop')::numeric;
      v_interest_cop := (v_row->>'interest_cop')::numeric;
      if (v_row->>'number')::integer is distinct from v_first_future + v_index - 1
         or (v_row->>'cutoff_date')::date is distinct from (v_snapshot->(v_index - 1)->>'cutoff_date')::date
         or v_principal is null or v_interest is null or v_principal_cop is null or v_interest_cop is null
         or v_principal::text in ('NaN', 'Infinity', '-Infinity') or v_interest::text in ('NaN', 'Infinity', '-Infinity')
         or v_principal_cop::text in ('NaN', 'Infinity', '-Infinity') or v_interest_cop::text in ('NaN', 'Infinity', '-Infinity')
         or v_principal < 0 or v_interest < 0 or v_principal_cop < 0 or v_interest_cop < 0
         or v_principal <> round(v_principal, 2) or v_interest <> round(v_interest, 2) or v_principal_cop <> round(v_principal_cop, 2) or v_interest_cop <> round(v_interest_cop, 2)
         or (v_row->>'total')::numeric is distinct from v_principal + v_interest or (v_row->>'total_cop')::numeric is distinct from v_principal_cop + v_interest_cop
         or (v_rate_free and v_interest <> 0) then
        raise exception 'Cuotas del abono inconsistentes' using errcode = '22023';
      end if;
      v_balance := v_balance - v_principal;
      if v_balance < 0 or (v_row->>'balance_after')::numeric is distinct from v_balance then
        raise exception 'Saldo de cuota inconsistente' using errcode = '22023';
      end if;
      if (v_currency = 'COP' and (v_principal_cop <> v_principal or v_interest_cop <> v_interest)) or
         (v_currency = 'USD' and (v_interest_cop <> round(v_interest * v_target.fx_rate, 2)
           or v_principal_cop <> (case when v_index = v_rows_count then v_target.amount_cop - v_sum_cop else round(v_principal * v_target.fx_rate, 2) end))) then
        raise exception 'Equivalente COP inconsistente' using errcode = '22023';
      end if;
      v_sum_cop := v_sum_cop + v_principal_cop;
    end loop;
    -- Invariant (D31, R9): Σ principal of the rows + Σ prepayments = amount, in the currency and in COP.
    if v_balance <> 0 or v_sum_cop <> v_target.amount_cop then
      raise exception 'Capital del abono inconsistente' using errcode = '22023';
    end if;

    insert into public.principal_prepayments (user_id, payment_id, transaction_id, amount, amount_cop, effect, assumed, replaced_from_number, replaced_installments)
    values (v_user, v_payment_id, v_target.id, v_value, v_value_cop, (v_prepayment->>'effect')::public.prepayment_effect, coalesce((v_prepayment->>'assumed')::boolean, false),
      v_first_future, v_snapshot);
    delete from public.installments where transaction_id = v_target.id and number >= v_first_future;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
      values (v_user, v_target.id, public.ensure_statement(v_card.id, (v_row->>'cutoff_date')::date), (v_row->>'number')::integer, (v_row->>'principal')::numeric,
        (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric,
        (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric);
    end loop;
  end loop;
  if v_prepaid_total > v_amount then raise exception 'Los abonos superan el pago' using errcode = '22023'; end if;

  -- D37: a payment that covers the minimum marks that currency as paid; an existing mark keeps its date (D26).
  if coalesce((p_payload->>'mark_paid')::boolean, false) then
    insert into public.statement_balances (user_id, statement_id, currency, paid_at)
    values (v_user, v_paid.id, v_currency::public.currency_code, (v_date::text || 'T05:00:00Z')::timestamptz)
    on conflict (statement_id, currency) do update set paid_at = coalesce(public.statement_balances.paid_at, excluded.paid_at);
  end if;
  return v_payment_id;
end;
$$;

-- D52: the used credit keeps pesos in pesos and values the net debt in dollars, in dollars, with the latest TRM in force.
-- Net in dollars = charges − payments − refunds − principal paid before tracking + billed installment interest, all in USD,
-- so a dollar payment made with pesos only moves the credit by the dollars paid. Without any TRM, the reference of each
-- purchase (D3) is used and flagged. New columns go last: a view keeps the order of its existing columns.
create or replace view public.card_balances with (security_invoker = true) as
with movement_totals as (
  select card_id,
    coalesce(sum(case when type in ('payment', 'refund') then -amount else amount end) filter (where currency = 'COP'), 0) as cop,
    coalesce(sum(case when type in ('payment', 'refund') then -amount else amount end) filter (where currency = 'USD'), 0) as usd,
    coalesce(sum(case when type in ('payment', 'refund') then -amount_cop else amount_cop end) filter (where currency = 'USD'), 0) as usd_reference
  from public.transactions group by card_id
), billed_interest as (
  select s.card_id,
    coalesce(sum(i.interest) filter (where t.currency = 'COP'), 0) as cop,
    coalesce(sum(i.interest) filter (where t.currency = 'USD'), 0) as usd,
    coalesce(sum(i.interest_cop) filter (where t.currency = 'USD'), 0) as usd_reference
  from public.installments i
  join public.statements s on s.id = i.statement_id
  join public.transactions t on t.id = i.transaction_id
  where s.cutoff_date <= (now() at time zone 'America/Bogota')::date
  group by s.card_id
), prior_principal as (
  select t.card_id,
    coalesce(sum(i.principal) filter (where t.currency = 'COP'), 0) as cop,
    coalesce(sum(i.principal) filter (where t.currency = 'USD'), 0) as usd,
    coalesce(sum(i.principal_cop) filter (where t.currency = 'USD'), 0) as usd_reference
  from public.installments i join public.transactions t on t.id = i.transaction_id
  where i.before_tracking
  group by t.card_id
), latest_rate as (
  select usd_cop from public.fx_rates order by date desc limit 1
), balances as (
  select c.id as card_id, c.user_id, c.credit_limit,
    coalesce(m.cop, 0) + coalesce(b.cop, 0) - coalesce(p.cop, 0) as cop_used,
    coalesce(m.usd, 0) + coalesce(b.usd, 0) - coalesce(p.usd, 0) as usd_net,
    coalesce(m.usd_reference, 0) + coalesce(b.usd_reference, 0) - coalesce(p.usd_reference, 0) as usd_reference,
    (select usd_cop from latest_rate) as fx_rate
  from public.cards c
  left join movement_totals m on m.card_id = c.id
  left join billed_interest b on b.card_id = c.id
  left join prior_principal p on p.card_id = c.id
), valued as (
  select *, cop_used + coalesce(round(usd_net * fx_rate, 2), usd_reference) as used from balances
)
select card_id, user_id, credit_limit, used, credit_limit - used as available,
  case when credit_limit = 0 then 0 else used / credit_limit end as utilization,
  cop_used, usd_net, fx_rate, fx_rate is null as fx_estimated
from valued;

create or replace function public.import_statement_file(p_payload jsonb, p_dry_run boolean)
returns jsonb language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_item jsonb;
  v_balance jsonb;
  v_id uuid;
  v_statement uuid;
  v_created integer := 0;
  v_linked integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if jsonb_typeof(p_payload->'create') is distinct from 'array' or jsonb_typeof(p_payload->'link') is distinct from 'array'
     or jsonb_typeof(p_payload->'statements') is distinct from 'array' then
    raise exception 'Importación inválida' using errcode = '22023';
  end if;

  -- The preview runs exactly the same code and undoes it at the end; variables survive the rollback of the block.
  begin
    -- New movements go through the registration RPC, so they are validated as any other one. Importing the same file
    -- twice does not duplicate them: the file key is unique per owner (D36).
    for v_item in select value from jsonb_array_elements(p_payload->'create') loop
      if char_length(v_item->>'key') not between 1 and 100 then raise exception 'Importación inválida' using errcode = '22023'; end if;
      continue when exists (select 1 from public.transactions where user_id = v_user and import_key = v_item->>'key');
      begin
        v_id := public.create_transaction_with_installments(v_item->'payload');
      exception when others then
        raise exception '%: %', v_item->>'key', sqlerrm using errcode = sqlstate;
      end;
      update public.transactions set import_key = v_item->>'key', source = 'import' where id = v_id and user_id = v_user;
      -- D41: the fee of a new advance comes with it and keeps the bank's line as its key.
      if v_item->'fee' is not null and jsonb_typeof(v_item->'fee') = 'object' then
        update public.transactions set import_key = v_item->'fee'->>'key', source = 'import', merchant = nullif(v_item->'fee'->>'merchant', '')
        where parent_id = v_id and user_id = v_user and type = 'advance_fee';
      end if;
      v_created := v_created + 1;
    end loop;

    -- "Es el mismo" only stores the file key on the existing movement; nothing else changes (D55).
    for v_item in select value from jsonb_array_elements(p_payload->'link') loop
      if char_length(v_item->>'key') not between 1 and 100 then raise exception 'Importación inválida' using errcode = '22023'; end if;
      continue when exists (select 1 from public.transactions where user_id = v_user and import_key = v_item->>'key');
      update public.transactions set import_key = v_item->>'key'
      where id = (v_item->>'transaction_id')::uuid and user_id = v_user and import_key is null and type <> 'payment';
      if found then v_linked := v_linked + 1; end if;
    end loop;

    -- Bank values of the statement, only where empty: never over values the owner already has, nor its reconciliation.
    for v_item in select value from jsonb_array_elements(p_payload->'statements') loop
      if not exists (select 1 from public.cards where id = (v_item->>'card_id')::uuid and user_id = v_user and archived_at is null) then
        raise exception 'Tarjeta no disponible' using errcode = '42501';
      end if;
      v_statement := public.ensure_statement((v_item->>'card_id')::uuid, (v_item->>'cutoff_date')::date);
      for v_balance in select value from jsonb_array_elements(v_item->'balances') loop
        if v_balance->>'currency' not in ('COP', 'USD') then raise exception 'Importación inválida' using errcode = '22023'; end if;
        insert into public.statement_balances (user_id, statement_id, currency, real_minimum, real_total)
        values (v_user, v_statement, (v_balance->>'currency')::public.currency_code, nullif(v_balance->>'real_minimum', '')::numeric, nullif(v_balance->>'real_total', '')::numeric)
        on conflict (statement_id, currency) do update set
          real_minimum = coalesce(public.statement_balances.real_minimum, excluded.real_minimum),
          real_total = coalesce(public.statement_balances.real_total, excluded.real_total);
        -- Verification: the calculated values next to the bank's, as the statement shows them.
        select jsonb_build_object(
          'card_id', v_item->>'card_id', 'cutoff_date', v_item->>'cutoff_date', 'currency', v_balance->>'currency',
          'minimum', coalesce(t.total_calculated, 0)::text, 'debt', coalesce(t.total_debt, 0)::text,
          'real_minimum', b.real_minimum::text, 'real_total', b.real_total::text,
          'available', (select available::text from public.card_balances where card_id = (v_item->>'card_id')::uuid),
          -- D52: the parts of the used credit, to value the dollars with the TRM of the statement.
          'credit_limit', (select credit_limit::text from public.card_balances where card_id = (v_item->>'card_id')::uuid),
          'cop_used', (select cop_used::text from public.card_balances where card_id = (v_item->>'card_id')::uuid),
          'usd_net', (select usd_net::text from public.card_balances where card_id = (v_item->>'card_id')::uuid))
        into v_result
        from public.statement_balances b
        left join public.statement_currency_totals t on t.statement_id = b.statement_id and t.currency = b.currency
        where b.statement_id = v_statement and b.currency = (v_balance->>'currency')::public.currency_code;
        v_results := v_results || jsonb_build_array(v_result);
      end loop;
    end loop;

    if p_dry_run then raise exception 'Vista previa' using errcode = 'P0D01'; end if;
  exception when sqlstate 'P0D01' then
    null;
  end;
  return jsonb_build_object('created', v_created, 'linked', v_linked, 'statements', v_results, 'dry_run', p_dry_run);
end;
$$;
