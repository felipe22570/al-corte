-- Step 32 (H10): typed payments and principal prepayments (F14, R9, D37, D38).

-- Schema ---------------------------------------------------------------------

create type public.payment_allocation_rule as enum ('bancolombia_priority', 'oldest_first', 'directed');
create type public.payment_kind as enum ('minimum', 'total', 'other');
create type public.prepayment_effect as enum ('reduce_term', 'reduce_installment');

alter table public.cards add column payment_allocation_rule public.payment_allocation_rule not null default 'bancolombia_priority';
comment on column public.cards.payment_allocation_rule is 'How the excess over the minimum is applied (D38): Bancolombia''s published order, oldest first or chosen by the owner.';

-- statement_id stays the R1 statement of the payment date (statement totals and credit use it);
-- paid_statement_id is the statement the payment covers.
alter table public.transactions
  add column paid_statement_id uuid,
  add column payment_kind public.payment_kind,
  add column is_international boolean,
  add constraint transactions_owner_paid_statement_fk foreign key (user_id, card_id, paid_statement_id) references public.statements (user_id, card_id, id),
  add constraint transactions_payment_kind_check check ((payment_kind is null) = (paid_statement_id is null) and (payment_kind is null or type = 'payment'));
create index transactions_paid_statement_idx on public.transactions (paid_statement_id) where paid_statement_id is not null;
comment on column public.transactions.paid_statement_id is 'Statement a typed payment covers (D37); statement_id keeps the statement of its date (R1).';
comment on column public.transactions.payment_kind is 'minimum, total or other (D37); null for payments registered as plain movements.';
comment on column public.transactions.is_international is 'Classifies purchases and advances in Bancolombia''s prepayment order (R9). True by default in USD.';

update public.transactions set is_international = (currency = 'USD' and type in ('purchase', 'cash_advance'));
alter table public.transactions
  alter column is_international set not null,
  add constraint transactions_is_international_check check (not is_international or type in ('purchase', 'cash_advance'));

-- Inserts that do not classify the movement (subscription charges, interest, fees) get the default.
create function public.set_transaction_international_default()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.is_international is null then
    new.is_international := new.currency = 'USD' and new.type in ('purchase', 'cash_advance');
  end if;
  return new;
end;
$$;
revoke all on function public.set_transaction_international_default() from public, anon, authenticated;
create trigger transactions_international_default before insert on public.transactions
for each row execute function public.set_transaction_international_default();

-- Invariant of every movement with prepayments: Σ principal of its installments (prior ones included) + Σ prepayments = amount (D31, R9).
-- replaced_installments keeps the unbilled rows the prepayment replaced, to restore them when it is undone (last in, first out).
create table public.principal_prepayments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  payment_id uuid not null,
  transaction_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  amount_cop numeric(14,2) not null check (amount_cop >= 0),
  effect public.prepayment_effect not null default 'reduce_term',
  assumed boolean not null default false,
  replaced_from_number smallint check (replaced_from_number between 1 and 72),
  replaced_installments jsonb,
  -- clock_timestamp orders prepayments registered in the same database transaction too.
  created_at timestamptz not null default clock_timestamp(),
  unique (payment_id, transaction_id),
  constraint principal_prepayments_owner_payment_fk foreign key (user_id, payment_id) references public.transactions (user_id, id) on delete cascade,
  constraint principal_prepayments_owner_transaction_fk foreign key (user_id, transaction_id) references public.transactions (user_id, id) on delete cascade,
  constraint principal_prepayments_snapshot_check check ((replaced_from_number is null) = (replaced_installments is null))
);
create index principal_prepayments_transaction_idx on public.principal_prepayments (transaction_id, created_at);
create index principal_prepayments_payment_idx on public.principal_prepayments (payment_id);
comment on table public.principal_prepayments is 'Excess of a payment applied to the principal of a movement (R9, D38). assumed marks the "oldest first" assumption within a level of Bancolombia''s order.';

alter table public.principal_prepayments enable row level security;
revoke all on public.principal_prepayments from anon;
grant select, insert, delete on public.principal_prepayments to authenticated;
create policy owner_select on public.principal_prepayments for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.principal_prepayments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_delete on public.principal_prepayments for delete to authenticated using ((select auth.uid()) = user_id);

-- Undoing a prepayment (deleting its payment) restores the rows it replaced. Only the latest prepayment of a movement
-- can be undone; a movement deleted with its plan has nothing to restore.
create function public.restore_prepayment()
returns trigger language plpgsql set search_path = '' as $$
declare
  v_card_id uuid;
  v_row jsonb;
begin
  select card_id into v_card_id from public.transactions where id = old.transaction_id;
  if not found then return old; end if;
  if exists (select 1 from public.principal_prepayments where transaction_id = old.transaction_id and created_at > old.created_at) then
    raise exception 'Borra primero el pago más reciente de esa compra' using errcode = '23514';
  end if;
  if old.replaced_installments is not null then
    delete from public.installments where transaction_id = old.transaction_id and number >= old.replaced_from_number;
    for v_row in select value from jsonb_array_elements(old.replaced_installments) loop
      insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
      values (old.user_id, old.transaction_id, public.ensure_statement(v_card_id, (v_row->>'cutoff_date')::date), (v_row->>'number')::integer,
        (v_row->>'principal')::numeric, (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric,
        (v_row->>'principal_cop')::numeric, (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric);
    end loop;
  end if;
  return old;
end;
$$;
revoke all on function public.restore_prepayment() from public, anon, authenticated;
create trigger principal_prepayments_restore before delete on public.principal_prepayments
for each row execute function public.restore_prepayment();

-- Totals per statement and currency (R5, R8, D33) -----------------------------------------------------------
-- Same view as step 30, plus prepayments:
-- * a prepayment to a single-installment charge still to be billed lowers that charge in its statement (R9);
-- * the debt at a cutoff counts the prepayments made after it, so a past statement keeps its debt.

create or replace view public.statement_currency_totals with (security_invoker = true) as
with prepaid as (
  select transaction_id, sum(amount) as amount, sum(amount_cop) as amount_cop from public.principal_prepayments group by transaction_id
), movements as (
  select t.statement_id, t.currency, t.type, t.source, t.installments_count,
    t.amount - coalesce(p.amount, 0) as amount, t.amount_cop - coalesce(p.amount_cop, 0) as amount_cop
  from public.transactions t left join prepaid p on p.transaction_id = t.id
), movement_totals as (
  select statement_id, currency,
    coalesce(sum(amount) filter (where type = 'purchase' and source <> 'subscription' and installments_count = 1), 0) as single_purchases,
    coalesce(sum(amount) filter (where type = 'purchase' and source = 'subscription' and installments_count = 1), 0) as subscriptions,
    coalesce(sum(amount) filter (where (type = 'cash_advance' and installments_count = 1) or type = 'advance_fee'), 0) as cash_advances,
    coalesce(sum(amount) filter (where type = 'interest'), 0) as interest,
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

-- Payment registration (D37, D38) -----------------------------------------------------------------------------
-- The plan comes from lib/domain/payments.ts; this function checks its invariants and writes it in one transaction:
-- the payment, each prepayment with the rows it replaces, the rebuilt unbilled installments and the payment mark.

create function public.register_payment(p_payload jsonb)
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
       or v_fx_rate <> round(v_fx_rate, 4) or v_amount_cop <> round(v_amount * v_fx_rate, 2))) then
    raise exception 'Moneda o TRM inconsistentes' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload->'prepayments') is distinct from 'array' then raise exception 'Datos del pago inválidos' using errcode = '22023'; end if;

  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, note, source, paid_statement_id, payment_kind, is_international)
  values (v_user, v_card.id, public.ensure_statement(v_card.id, public.statement_cutoff_for(v_card.cutoff_day, v_date)), 'payment', v_date, v_amount,
    v_currency::public.currency_code, v_fx_rate, v_amount_cop, 1, nullif(p_payload->>'note', ''), 'manual', v_paid.id, v_kind::public.payment_kind, false)
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
revoke all on function public.register_payment(jsonb) from public, anon;
grant execute on function public.register_payment(jsonb) to authenticated;

-- Descriptive edit of movements whose plan or payment cannot be regenerated (R9) -------------------------------

create function public.update_transaction_details(p_id uuid, p_payload jsonb)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_category_id uuid := nullif(p_payload->>'category_id', '')::uuid;
begin
  if v_user is null then raise exception 'No autorizado' using errcode = '42501'; end if;
  if v_category_id is not null and not exists (select 1 from public.categories where id = v_category_id and user_id = v_user and archived_at is null) then
    raise exception 'Categoría no disponible' using errcode = '22023';
  end if;
  if char_length(coalesce(p_payload->>'merchant', '')) > 200 or char_length(coalesce(p_payload->>'note', '')) > 1000 then
    raise exception 'Datos del movimiento inválidos' using errcode = '22023';
  end if;
  update public.transactions set category_id = v_category_id, merchant = nullif(p_payload->>'merchant', ''), note = nullif(p_payload->>'note', '')
  where id = p_id and user_id = v_user;
  if not found then raise exception 'Movimiento no disponible' using errcode = '42501'; end if;
  return p_id;
end;
$$;
revoke all on function public.update_transaction_details(uuid, jsonb) from public, anon;
grant execute on function public.update_transaction_details(uuid, jsonb) to authenticated;

-- Registration and edit RPCs: same as steps 27 and 29, with is_international and the prepayment guard ------------

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
  if v_type not in ('purchase', 'cash_advance') and v_is_international then
    raise exception 'Solo las compras y los avances pueden ser internacionales' using errcode = '22023';
  end if;
  -- D15: new plans up to 36 installments. D50: effective in-progress plans up to 72, original N up to 36.
  if v_prior = 0 then
    if v_count > 36 or v_prior_paid <> 0 or v_original is not null or v_tracked_from is not null then
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
  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, interest_free, rate_ea_applied, category_id, merchant, note, source, prior_installments, prior_principal_paid, original_installments_count, is_international)
  values (v_user, v_card_id, v_statement_id, v_type::public.transaction_type, v_date, v_amount, v_currency::public.currency_code, v_fx_rate, v_amount_cop, v_count, v_interest_free, v_rate, v_category_id, nullif(p_payload->>'merchant', ''), nullif(p_payload->>'note', ''), 'manual', v_prior, v_prior_paid, v_original, v_is_international)
  returning id into v_transaction_id;

  v_index := 0;
  for v_row in select value from jsonb_array_elements(p_payload->'installments') loop
    v_index := v_index + 1;
    v_statement_id := case when v_index <= v_prior then null else public.ensure_statement(v_card_id, (v_row->>'cutoff_date')::date) end;
    insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop, before_tracking)
    values (v_user, v_transaction_id, v_statement_id, (v_row->>'number')::integer, (v_row->>'principal')::numeric, (v_row->>'interest')::numeric, (v_row->>'total')::numeric, (v_row->>'balance_after')::numeric, (v_row->>'principal_cop')::numeric, (v_row->>'interest_cop')::numeric, (v_row->>'total_cop')::numeric, v_index <= v_prior);
  end loop;
  -- An in-progress advance already paid its fee before tracking.
  if v_type = 'cash_advance' and v_card.advance_fee > 0 and v_prior = 0 then
    v_statement_id := public.ensure_statement(v_card_id, v_first_cutoff);
    insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, amount_cop, parent_id, source)
    values (v_user, v_card_id, v_statement_id, 'advance_fee', v_date, v_card.advance_fee, 'COP', v_card.advance_fee, v_transaction_id, 'manual');
  end if;
  return v_transaction_id;
end;
$$;
revoke all on function public.create_transaction_with_installments(jsonb) from public, anon;
grant execute on function public.create_transaction_with_installments(jsonb) to authenticated;

create or replace function public.update_transaction_with_installments(p_id uuid, p_payload jsonb)
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
  -- R9: regenerating the plan would undo prepayments; typed payments keep their statement and prepayments.
  -- Only category, merchant and note change, through edit_transaction_details.
  if v_original.paid_statement_id is not null
     or exists (select 1 from public.principal_prepayments where transaction_id = p_id or payment_id = p_id) then
    raise exception 'Este movimiento tiene abonos a capital' using errcode = '22023';
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
    interest_free = v_new.interest_free, rate_ea_applied = v_expected_rate, note = v_new.note,
    prior_installments = v_new.prior_installments, prior_principal_paid = v_new.prior_principal_paid,
    original_installments_count = v_new.original_installments_count, is_international = v_new.is_international
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
