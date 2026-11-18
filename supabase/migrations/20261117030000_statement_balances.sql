-- Step 30 (H10): minimum payment, total debt and balances per currency (F12, R8, D33).
-- statements.real_total and statements.paid_at move to statement_balances: one source for payment marks.

create table public.statement_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  statement_id uuid not null references public.statements on delete cascade,
  currency public.currency_code not null,
  real_minimum numeric(14,2) check (real_minimum >= 0),
  real_total numeric(14,2) check (real_total >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (statement_id, currency),
  constraint statement_balances_owner_statement_fk foreign key (user_id, statement_id) references public.statements (user_id, id) on delete cascade
);
comment on table public.statement_balances is 'Bank values and payment mark per statement and currency (D33). Bank values are a reference and never replace the calculation (D27).';
create trigger statement_balances_updated_at before update on public.statement_balances for each row execute function public.set_updated_at();

alter table public.statement_balances enable row level security;
revoke all on public.statement_balances from anon;
grant select, insert, update, delete on public.statement_balances to authenticated;
create policy owner_select on public.statement_balances for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.statement_balances for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_update on public.statement_balances for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy owner_delete on public.statement_balances for delete to authenticated using ((select auth.uid()) = user_id);

-- Existing marks were per statement and in pesos. The bank total goes to the COP row. A statement already
-- marked as paid keeps that state (D26): the mark is copied to every currency with charges.
insert into public.statement_balances (user_id, statement_id, currency, real_total, paid_at)
select user_id, id, 'COP', real_total, paid_at from public.statements where real_total is not null or paid_at is not null;
insert into public.statement_balances (user_id, statement_id, currency, paid_at)
select s.user_id, s.id, 'USD', s.paid_at from public.statements s
where s.paid_at is not null and (
  exists (select 1 from public.transactions t where t.statement_id = s.id and t.currency = 'USD')
  or exists (select 1 from public.installments i join public.transactions t on t.id = i.transaction_id where i.statement_id = s.id and t.currency = 'USD')
);

alter table public.statements drop column real_total, drop column paid_at;

-- Totals per statement and currency, in the original currency (R5, D33) -----------------------------
-- total_calculated is the minimum payment before the on-balance interest estimate, which the app adds (R8).
-- pending_principal: principal of the card's purchases and advances in that currency still to be billed
-- after the statement; total_debt = total_calculated + pending_principal.

drop view public.statement_totals;

create view public.statement_currency_totals with (security_invoker = true) as
with movement_totals as (
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
  from public.transactions group by statement_id, currency
), installment_totals as (
  select i.statement_id, t.currency, sum(i.total) as installments, sum(i.total_cop) as installments_cop
  from public.installments i join public.transactions t on t.id = i.transaction_id
  where i.statement_id is not null
  group by i.statement_id, t.currency
), pending as (
  select s.id as statement_id, t.currency, sum(i.principal) as pending_principal
  from public.statements s
  join public.transactions t on t.card_id = s.card_id and t.type in ('purchase', 'cash_advance') and t.installments_count > 1
  join public.statements purchase_statement on purchase_statement.id = t.statement_id and purchase_statement.cutoff_date <= s.cutoff_date
  join public.installments i on i.transaction_id = t.id and not i.before_tracking
  join public.statements installment_statement on installment_statement.id = i.statement_id and installment_statement.cutoff_date > s.cutoff_date
  group by s.id, t.currency
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

comment on view public.statement_currency_totals is 'R5 total (minimum payment) and total debt per statement and currency (D33). total_cop is a reference equivalent only.';
revoke all on public.statement_currency_totals from public, anon;
grant select on public.statement_currency_totals to authenticated;
