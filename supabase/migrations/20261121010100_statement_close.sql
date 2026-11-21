-- Step 33 (H10): monthly statement close (F15, D39).

-- Bank values per currency: reconciliation mark and the rate in force (D39) -------------------------------------
alter table public.statement_balances
  add column reconciled_at timestamptz,
  add column rate_ea numeric(9,6) check (rate_ea >= 0);
comment on column public.statement_balances.reconciled_at is 'Statement closed against the bank in this currency (D39); it can be reopened. Reconciled statements carry no interest estimate.';
comment on column public.statement_balances.rate_ea is 'Purchase rate in force printed by the bank, as E.A. It applies only to new purchases (D39).';

-- Balance corrections (D39): the bank balance of a purchase after a statement. They live with the prepayments so the
-- invariant Σ principal of installments + Σ prepayments and corrections = amount, and the last-in-first-out undo, hold
-- for both. A correction is signed: positive when the bank balance is lower than the calculated one.
alter table public.principal_prepayments
  alter column payment_id drop not null,
  add column statement_id uuid,
  add column bank_balance numeric(14,2),
  drop constraint principal_prepayments_amount_check,
  drop constraint principal_prepayments_amount_cop_check,
  add constraint principal_prepayments_owner_statement_fk foreign key (user_id, statement_id) references public.statements (user_id, id) on delete cascade,
  add constraint principal_prepayments_origin_check check ((payment_id is null) <> (statement_id is null)),
  add constraint principal_prepayments_amount_check check (amount <> 0 and (statement_id is not null or amount > 0)),
  add constraint principal_prepayments_amount_cop_check check (statement_id is not null or amount_cop >= 0),
  add constraint principal_prepayments_correction_check check (
    (bank_balance is null) = (statement_id is null) and (bank_balance is null or bank_balance >= 0)
    and (statement_id is null or replaced_from_number is not null)
  );
create unique index principal_prepayments_correction_unique on public.principal_prepayments (statement_id, transaction_id) where statement_id is not null;
comment on column public.principal_prepayments.statement_id is 'Statement whose bank balance corrected the plan (D39); null for prepayments of a payment.';
comment on column public.principal_prepayments.bank_balance is 'Balance of the purchase after the statement, copied from the bank (D39).';

-- Totals per statement and currency (R5, R8, D33) -----------------------------------------------------------
-- Same view as step 32, plus late interest within interest, and corrections in the debt of earlier cutoffs
-- (a correction applies from the cutoff of its statement, so the debt of that statement is the bank's).

create or replace view public.statement_currency_totals with (security_invoker = true) as
with prepaid as (
  select transaction_id, sum(amount) as amount, sum(amount_cop) as amount_cop from public.principal_prepayments where payment_id is not null group by transaction_id
), movements as (
  select t.statement_id, t.currency, t.type, t.source, t.installments_count,
    t.amount - coalesce(p.amount, 0) as amount, t.amount_cop - coalesce(p.amount_cop, 0) as amount_cop
  from public.transactions t left join prepaid p on p.transaction_id = t.id
), movement_totals as (
  select statement_id, currency,
    coalesce(sum(amount) filter (where type = 'purchase' and source <> 'subscription' and installments_count = 1), 0) as single_purchases,
    coalesce(sum(amount) filter (where type = 'purchase' and source = 'subscription' and installments_count = 1), 0) as subscriptions,
    coalesce(sum(amount) filter (where (type = 'cash_advance' and installments_count = 1) or type = 'advance_fee'), 0) as cash_advances,
    coalesce(sum(amount) filter (where type in ('interest', 'late_interest')), 0) as interest,
    coalesce(sum(amount) filter (where type = 'handling_fee'), 0) as handling_fees,
    coalesce(sum(amount) filter (where type = 'insurance'), 0) as insurance,
    coalesce(sum(amount) filter (where type = 'adjustment'), 0) as adjustments,
    coalesce(sum(amount) filter (where type = 'refund'), 0) as refunds,
    coalesce(sum(amount) filter (where type = 'payment'), 0) as payments,
    coalesce(sum(amount_cop) filter (where type not in ('payment', 'refund') and not (type in ('purchase', 'cash_advance') and installments_count > 1)), 0)
      - coalesce(sum(amount_cop) filter (where type = 'refund'), 0) as charges_cop
  from movements group by statement_id, currency
), installment_totals as (
  select i.statement_id, t.currency, sum(i.total) as installments, sum(i.total_cop) as installments_cop
  from public.installments i join public.transactions t on t.id = i.transaction_id
  where i.statement_id is not null
  group by i.statement_id, t.currency
), debt_purchases as (
  select s.id as statement_id, s.cutoff_date, t.id as transaction_id, t.currency
  from public.statements s
  join public.transactions t on t.card_id = s.card_id and t.type in ('purchase', 'cash_advance') and t.installments_count > 1
  join public.statements purchase_statement on purchase_statement.id = t.statement_id and purchase_statement.cutoff_date <= s.cutoff_date
), pending as (
  select statement_id, currency, sum(principal) as pending_principal from (
    select d.statement_id, d.currency, i.principal
    from debt_purchases d
    join public.installments i on i.transaction_id = d.transaction_id and not i.before_tracking
    join public.statements installment_statement on installment_statement.id = i.statement_id and installment_statement.cutoff_date > d.cutoff_date
    union all
    select d.statement_id, d.currency, pp.amount
    from debt_purchases d
    join public.principal_prepayments pp on pp.transaction_id = d.transaction_id
    join public.transactions payment on payment.id = pp.payment_id and payment.date > d.cutoff_date
    union all
    select d.statement_id, d.currency, pp.amount
    from debt_purchases d
    join public.principal_prepayments pp on pp.transaction_id = d.transaction_id
    join public.statements correction on correction.id = pp.statement_id and correction.cutoff_date > d.cutoff_date
  ) pending_rows group by statement_id, currency
), keys as (
  select statement_id, currency, true as has_charges from movement_totals
  union select statement_id, currency, true from installment_totals
  union select statement_id, currency, false from pending
), currency_keys as (
  select statement_id, currency, bool_or(has_charges) as has_charges from keys group by statement_id, currency
), totals as (
  select s.id as statement_id, s.user_id, s.card_id, k.currency, k.has_charges,
    coalesce(m.single_purchases, 0) as single_purchases,
    coalesce(i.installments, 0) as installments,
    coalesce(m.subscriptions, 0) as subscriptions,
    coalesce(m.cash_advances, 0) as cash_advances,
    coalesce(m.interest, 0) as interest,
    coalesce(m.handling_fees, 0) as handling_fees,
    coalesce(m.insurance, 0) as insurance,
    coalesce(m.adjustments, 0) as adjustments,
    coalesce(m.refunds, 0) as refunds,
    coalesce(m.payments, 0) as payments,
    coalesce(m.charges_cop, 0) + coalesce(i.installments_cop, 0) as total_cop,
    coalesce(p.pending_principal, 0) as pending_principal
  from currency_keys k
  join public.statements s on s.id = k.statement_id
  left join movement_totals m on m.statement_id = k.statement_id and m.currency = k.currency
  left join installment_totals i on i.statement_id = k.statement_id and i.currency = k.currency
  left join pending p on p.statement_id = k.statement_id and p.currency = k.currency
)
select *,
  single_purchases + installments + subscriptions + cash_advances + interest + handling_fees + insurance + adjustments - refunds as total_calculated,
  single_purchases + installments + subscriptions + cash_advances + interest + handling_fees + insurance + adjustments - refunds + pending_principal as total_debt
from totals;

-- Monthly close (F15, D39) -----------------------------------------------------------------------------------------
-- Writes in one transaction: bank values, the rate in force, real interest and late interest charges, balance
-- corrections (planned by lib/domain/reconciliation.ts, checked here) and the reconciliation mark of one currency.

create function public.close_statement(p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_statement public.statements%rowtype;
  v_card public.cards%rowtype;
  v_target public.transactions%rowtype;
  v_currency text := p_payload->>'currency';
  v_fx_rate numeric := nullif(p_payload->>'fx_rate', '')::numeric;
  v_rate numeric := nullif(p_payload->>'rate_ea', '')::numeric;
  v_kind text;
  v_value numeric;
  v_existing uuid;
  v_count integer;
  v_correction jsonb;
  v_row jsonb;
  v_bank numeric;
  v_amount numeric;
  v_amount_cop numeric;
  v_first_future integer;
  v_kept numeric;
  v_kept_cop numeric;
  v_prepaid_before numeric;
  v_prepaid_after numeric;
  v_prepaid_cop numeric;
  v_snapshot jsonb;
  v_future_count integer;
  v_kept_count integer;
  v_rows jsonb;
  v_rows_count integer;
  v_balance numeric;
  v_index integer;
  v_principal numeric;
  v_interest numeric;
  v_principal_cop numeric;
  v_interest_cop numeric;
  v_sum_cop numeric;
  v_expected date;
  v_rate_free boolean;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  select * into v_statement from public.statements where id = nullif(p_payload->>'statement_id', '')::uuid and user_id = v_user;
  if not found then raise exception 'Extracto no disponible' using errcode = '42501'; end if;
  select * into v_card from public.cards where id = v_statement.card_id and user_id = v_user for share;
  if v_currency is null or v_currency not in ('COP', 'USD') then raise exception 'Moneda inválida' using errcode = '22023'; end if;
  if v_statement.cutoff_date >= (now() at time zone 'America/Bogota')::date then
    raise exception 'El extracto aún no ha cortado' using errcode = '22023';
  end if;
  if (v_rate is not null and (v_rate < 0 or v_rate > 999.999999 or v_rate <> round(v_rate, 6)))
     or (v_currency = 'COP' and v_fx_rate is not null)
     or (v_fx_rate is not null and (v_fx_rate <= 0 or v_fx_rate > 99999999.9999 or v_fx_rate <> round(v_fx_rate, 4))) then
    raise exception 'Datos del cierre inválidos' using errcode = '22023';
  end if;

  -- Bank values and the rate in force; the rate applies to new purchases only (D39).
  insert into public.statement_balances (user_id, statement_id, currency, real_minimum, real_total, rate_ea, reconciled_at)
  values (v_user, v_statement.id, v_currency::public.currency_code, nullif(p_payload->>'real_minimum', '')::numeric, nullif(p_payload->>'real_total', '')::numeric, v_rate,
    case when coalesce((p_payload->>'reconcile')::boolean, false) then now() end)
  -- A value sent empty is removed; a value not sent is kept.
  on conflict (statement_id, currency) do update set
    real_minimum = case when p_payload ? 'real_minimum' then excluded.real_minimum else public.statement_balances.real_minimum end,
    real_total = case when p_payload ? 'real_total' then excluded.real_total else public.statement_balances.real_total end,
    rate_ea = case when p_payload ? 'rate_ea' then excluded.rate_ea else public.statement_balances.rate_ea end,
    reconciled_at = coalesce(excluded.reconciled_at, public.statement_balances.reconciled_at);
  if v_rate is not null and v_card.archived_at is null then
    update public.cards set purchase_rate_ea = v_rate where id = v_card.id;
  end if;

  -- Real interest and late interest replace the estimate (D32). Empty keeps what exists; zero removes it.
  foreach v_kind in array array['interest', 'late_interest'] loop
    v_value := nullif(p_payload->>v_kind, '')::numeric;
    continue when v_value is null;
    if v_value < 0 or v_value > 999999999999.99 or v_value <> round(v_value, 2) or (v_value > 0 and v_currency = 'USD' and v_fx_rate is null) then
      raise exception 'Intereses inválidos' using errcode = '22023';
    end if;
    select count(*), min(id::text)::uuid into v_count, v_existing from public.transactions
    where statement_id = v_statement.id and user_id = v_user and type = v_kind::public.transaction_type and currency = v_currency::public.currency_code;
    if v_count > 1 then raise exception 'El extracto tiene varios intereses registrados' using errcode = '22023'; end if;
    if v_value = 0 then
      delete from public.transactions where id = v_existing;
    elsif v_existing is not null then
      update public.transactions set amount = v_value, fx_rate = v_fx_rate, amount_cop = case when v_currency = 'COP' then v_value else round(v_value * v_fx_rate, 2) end
      where id = v_existing;
    else
      insert into public.transactions (user_id, card_id, statement_id, type, date, merchant, amount, currency, fx_rate, amount_cop, source)
      values (v_user, v_card.id, v_statement.id, v_kind::public.transaction_type, v_statement.cutoff_date,
        case when v_kind = 'interest' then 'Intereses' else 'Intereses de mora' end, v_value, v_currency::public.currency_code, v_fx_rate,
        case when v_currency = 'COP' then v_value else round(v_value * v_fx_rate, 2) end, 'manual');
    end if;
  end loop;

  -- A cleared or replaced bank balance undoes the previous correction; the trigger restores its rows (last in, first out).
  delete from public.principal_prepayments
  where statement_id = v_statement.id and user_id = v_user
    and transaction_id in (
      select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'remove_corrections', '[]'::jsonb))
      union select (value->>'transaction_id')::uuid from jsonb_array_elements(coalesce(p_payload->'corrections', '[]'::jsonb))
    );

  for v_correction in select value from jsonb_array_elements(coalesce(p_payload->'corrections', '[]'::jsonb)) loop
    v_bank := nullif(v_correction->>'bank_balance', '')::numeric;
    v_amount := nullif(v_correction->>'amount', '')::numeric;
    v_amount_cop := nullif(v_correction->>'amount_cop', '')::numeric;
    if v_bank is null or v_amount is null or v_amount_cop is null or v_bank < 0 or v_bank <> round(v_bank, 2) or v_amount = 0
       or v_amount <> round(v_amount, 2) or v_amount_cop <> round(v_amount_cop, 2) then
      raise exception 'Saldo del banco inválido' using errcode = '22023';
    end if;
    -- Only purchases and advances in installments of this card, currency and debt (billed up to this cutoff).
    select t.* into v_target from public.transactions t join public.statements ps on ps.id = t.statement_id
    where t.id = nullif(v_correction->>'transaction_id', '')::uuid and t.user_id = v_user and t.card_id = v_card.id
      and t.currency = v_currency::public.currency_code and t.type in ('purchase', 'cash_advance') and t.installments_count > 1 and ps.cutoff_date <= v_statement.cutoff_date
    for update of t;
    if not found then raise exception 'La compra del saldo no está disponible' using errcode = '22023'; end if;

    select min(i.number) into v_first_future from public.installments i join public.statements s on s.id = i.statement_id
    where i.transaction_id = v_target.id and not i.before_tracking and s.cutoff_date > v_statement.cutoff_date;
    select coalesce(sum(principal), 0), coalesce(sum(principal_cop), 0), count(*), coalesce(max(number), 0) + 1 into v_kept, v_kept_cop, v_kept_count, v_index
    from public.installments where transaction_id = v_target.id and number < coalesce(v_first_future, 73);
    v_first_future := coalesce(v_first_future, v_index);
    -- Prepayments up to the cutoff are in the bank balance; later ones are not yet.
    select coalesce(sum(pp.amount) filter (where coalesce(payment.date, correction.cutoff_date) <= v_statement.cutoff_date), 0),
           coalesce(sum(pp.amount) filter (where coalesce(payment.date, correction.cutoff_date) > v_statement.cutoff_date), 0),
           coalesce(sum(pp.amount_cop), 0)
    into v_prepaid_before, v_prepaid_after, v_prepaid_cop
    from public.principal_prepayments pp
    left join public.transactions payment on payment.id = pp.payment_id
    left join public.statements correction on correction.id = pp.statement_id
    where pp.transaction_id = v_target.id;
    if v_amount <> v_target.amount - v_kept - v_prepaid_before - v_bank or v_bank - v_prepaid_after < 0
       or nullif(v_correction->>'replaced_from_number', '')::integer is distinct from v_first_future then
      raise exception 'Saldo del banco inconsistente' using errcode = '22023';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object('number', i.number, 'cutoff_date', s.cutoff_date, 'principal', i.principal, 'interest', i.interest, 'total', i.total,
      'balance_after', i.balance_after, 'principal_cop', i.principal_cop, 'interest_cop', i.interest_cop, 'total_cop', i.total_cop) order by i.number), '[]'::jsonb), count(*)
    into v_snapshot, v_future_count
    from public.installments i join public.statements s on s.id = i.statement_id
    where i.transaction_id = v_target.id and i.number >= v_first_future;

    v_rows := coalesce(v_correction->'installments', '[]'::jsonb);
    if jsonb_typeof(v_rows) <> 'array' then raise exception 'Saldo del banco inválido' using errcode = '22023'; end if;
    v_rows_count := jsonb_array_length(v_rows);
    -- D50: the effective plan, billed and new installments, has at most 72.
    if v_kept_count + v_rows_count > 72 or (v_rows_count = 0 and v_bank - v_prepaid_after <> 0) then
      raise exception 'Cuotas del saldo inconsistentes' using errcode = '22023';
    end if;
    if v_currency = 'COP' and v_amount_cop <> v_amount
       or v_currency = 'USD' and v_amount_cop <> (case when v_rows_count = 0 then v_target.amount_cop - v_kept_cop - v_prepaid_cop else round(v_amount * v_target.fx_rate, 2) end) then
      raise exception 'Equivalente COP del saldo inconsistente' using errcode = '22023';
    end if;
    v_rate_free := v_target.interest_free or v_card.interest_mode = 'on_balance';
    v_balance := v_bank - v_prepaid_after;
    v_sum_cop := v_kept_cop + v_prepaid_cop + v_amount_cop;
    v_expected := v_statement.cutoff_date;
    v_index := 0;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      v_index := v_index + 1;
      -- Same statements as the rows it replaces; further ones follow the card's cutoff day.
      v_expected := case when v_index <= v_future_count then (v_snapshot->(v_index - 1)->>'cutoff_date')::date
        else public.cutoff_date_for_month(v_card.cutoff_day, extract(year from v_expected + interval '1 month')::integer, extract(month from v_expected + interval '1 month')::integer) end;
      v_principal := (v_row->>'principal')::numeric;
      v_interest := (v_row->>'interest')::numeric;
      v_principal_cop := (v_row->>'principal_cop')::numeric;
      v_interest_cop := (v_row->>'interest_cop')::numeric;
      if (v_row->>'number')::integer is distinct from v_first_future + v_index - 1
         or (v_row->>'cutoff_date')::date is distinct from v_expected
         or v_principal is null or v_interest is null or v_principal_cop is null or v_interest_cop is null
         or v_principal < 0 or v_interest < 0 or v_principal_cop < 0 or v_interest_cop < 0
         or v_principal <> round(v_principal, 2) or v_interest <> round(v_interest, 2) or v_principal_cop <> round(v_principal_cop, 2) or v_interest_cop <> round(v_interest_cop, 2)
         or (v_row->>'total')::numeric is distinct from v_principal + v_interest or (v_row->>'total_cop')::numeric is distinct from v_principal_cop + v_interest_cop
         or (v_rate_free and v_interest <> 0) then
        raise exception 'Cuotas del saldo inconsistentes' using errcode = '22023';
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
    -- Invariant (D31, R9): Σ principal of the rows + Σ prepayments and corrections = amount, in the currency and in COP.
    if v_balance <> 0 or v_sum_cop <> v_target.amount_cop then
      raise exception 'Capital del saldo inconsistente' using errcode = '22023';
    end if;

    insert into public.principal_prepayments (user_id, statement_id, transaction_id, amount, amount_cop, effect, assumed, bank_balance, replaced_from_number, replaced_installments)
    values (v_user, v_statement.id, v_target.id, v_amount, v_amount_cop, 'reduce_term', false, v_bank, v_first_future, v_snapshot);
    delete from public.installments where transaction_id = v_target.id and number >= v_first_future;
    for v_row in select value from jsonb_array_elements(v_rows) loop
      insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
      values (v_user, v_target.id, public.ensure_statement(v_card.id, (v_row->>'cutoff_date')::date), (v_row->>'number')::integer, (v_row->>'principal')::numeric,
        (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric,
        (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric);
    end loop;
  end loop;
  return v_statement.id;
end;
$$;
revoke all on function public.close_statement(jsonb) from public, anon;
grant execute on function public.close_statement(jsonb) to authenticated;

-- Reopening removes only the mark: bank values and corrections stay (D39).
create function public.reopen_statement(p_statement_id uuid, p_currency public.currency_code)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  update public.statement_balances set reconciled_at = null where statement_id = p_statement_id and currency = p_currency and user_id = auth.uid();
  if not found then raise exception 'Extracto no disponible' using errcode = '42501'; end if;
  return p_statement_id;
end;
$$;
revoke all on function public.reopen_statement(uuid, public.currency_code) from public, anon;
grant execute on function public.reopen_statement(uuid, public.currency_code) to authenticated;
