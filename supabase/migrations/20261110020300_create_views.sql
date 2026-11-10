create view public.statement_totals with (security_invoker = true) as
with movement_totals as (
  select statement_id,
    coalesce(sum(amount_cop) filter (where type = 'purchase' and source <> 'subscription' and installments_count = 1), 0) as single_purchases,
    coalesce(sum(amount_cop) filter (where type = 'purchase' and source = 'subscription' and installments_count = 1), 0) as subscriptions,
    coalesce(sum(amount_cop) filter (where (type = 'cash_advance' and installments_count = 1) or type = 'advance_fee'), 0) as cash_advances,
    coalesce(sum(amount_cop) filter (where type = 'interest'), 0) as interest,
    coalesce(sum(amount_cop) filter (where type = 'handling_fee'), 0) as handling_fees,
    coalesce(sum(amount_cop) filter (where type = 'insurance'), 0) as insurance,
    coalesce(sum(amount_cop) filter (where type = 'adjustment'), 0) as adjustments,
    coalesce(sum(amount_cop) filter (where type = 'refund'), 0) as refunds,
    coalesce(sum(amount_cop) filter (where type = 'payment'), 0) as payments
  from public.transactions group by statement_id
), installment_totals as (
  select statement_id, sum(total_cop) as installments from public.installments group by statement_id
), totals as (
  select s.id as statement_id, s.user_id, s.card_id,
    coalesce(m.single_purchases, 0) as single_purchases,
    coalesce(i.installments, 0) as installments,
    coalesce(m.subscriptions, 0) as subscriptions,
    coalesce(m.cash_advances, 0) as cash_advances,
    coalesce(m.interest, 0) as interest,
    coalesce(m.handling_fees, 0) as handling_fees,
    coalesce(m.insurance, 0) as insurance,
    coalesce(m.adjustments, 0) as adjustments,
    coalesce(m.refunds, 0) as refunds,
    coalesce(m.payments, 0) as payments
  from public.statements s
  left join movement_totals m on m.statement_id = s.id
  left join installment_totals i on i.statement_id = s.id
)
select *, single_purchases + installments + subscriptions + cash_advances + interest + handling_fees + insurance + adjustments - refunds as total_calculated
from totals;

create view public.card_balances with (security_invoker = true) as
with movement_totals as (
  select card_id,
    coalesce(sum(case when type in ('payment', 'refund') then -amount_cop else amount_cop end), 0) as net_charges
  from public.transactions group by card_id
), billed_interest as (
  select s.card_id, sum(i.interest_cop) as interest_cop
  from public.installments i join public.statements s on s.id = i.statement_id
  where s.cutoff_date <= (now() at time zone 'America/Bogota')::date
  group by s.card_id
), balances as (
  select c.id as card_id, c.user_id, c.credit_limit,
    coalesce(m.net_charges, 0) + coalesce(b.interest_cop, 0) as used
  from public.cards c
  left join movement_totals m on m.card_id = c.id
  left join billed_interest b on b.card_id = c.id
)
select card_id, user_id, credit_limit, used, credit_limit - used as available,
  case when credit_limit = 0 then 0 else used / credit_limit end as utilization
from balances;

revoke all on public.statement_totals, public.card_balances from public, anon;
grant select on public.statement_totals, public.card_balances to authenticated;
