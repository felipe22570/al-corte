-- Step 27 (H10): purchases with installments paid before tracking (R8, D31, D49, D50)
-- and COP amounts calculated with cents (D48). Existing whole-peso data stays valid.

-- Schema ---------------------------------------------------------------------

alter table public.transactions
  add column prior_installments smallint not null default 0,
  add column prior_principal_paid numeric(14,2) not null default 0,
  add column original_installments_count smallint;

comment on column public.transactions.installments_count is 'Effective plan (D31). New purchases: 1 to 36 (D15); in-progress plans: up to 72 (D50).';
comment on column public.transactions.prior_installments is 'Installments paid before Al Corte (p = k − 1). They never belong to a statement.';
comment on column public.transactions.prior_principal_paid is 'Principal paid before Al Corte (c), in the transaction currency.';
comment on column public.transactions.original_installments_count is 'Original N when the effective plan differs because of a prior prepayment; null otherwise.';

alter table public.transactions
  drop constraint transactions_installments_count_check,
  add constraint transactions_installments_count_check check (installments_count between 1 and 72),
  add constraint transactions_prior_installments_check check (prior_installments >= 0 and prior_installments < installments_count),
  add constraint transactions_prior_principal_paid_check check (
    prior_principal_paid >= 0 and prior_principal_paid < amount and (prior_installments > 0 or prior_principal_paid = 0)
  ),
  add constraint transactions_original_installments_count_check check (
    original_installments_count is null
    or (prior_installments > 0 and original_installments_count between 2 and 36 and original_installments_count <> installments_count)
  );

alter table public.installments
  add column before_tracking boolean not null default false,
  alter column statement_id drop not null;

comment on column public.installments.before_tracking is 'Paid before Al Corte: no statement, no interest; excluded from statements, months and credit.';

alter table public.installments
  drop constraint installments_number_check,
  add constraint installments_number_check check (number between 1 and 72),
  add constraint installments_before_tracking_check check (
    before_tracking = (statement_id is null) and (not before_tracking or (interest = 0 and interest_cop = 0))
  );

-- Credit (D2): an in-progress purchase only uses its pending principal -------

create or replace view public.card_balances with (security_invoker = true) as
with movement_totals as (
  select card_id,
    coalesce(sum(case when type in ('payment', 'refund') then -amount_cop else amount_cop end), 0) as net_charges
  from public.transactions group by card_id
), billed_interest as (
  select s.card_id, sum(i.interest_cop) as interest_cop
  from public.installments i join public.statements s on s.id = i.statement_id
  where s.cutoff_date <= (now() at time zone 'America/Bogota')::date
  group by s.card_id
), prior_principal as (
  select t.card_id, sum(i.principal_cop) as principal_cop
  from public.installments i join public.transactions t on t.id = i.transaction_id
  where i.before_tracking
  group by t.card_id
), balances as (
  select c.id as card_id, c.user_id, c.credit_limit,
    coalesce(m.net_charges, 0) + coalesce(b.interest_cop, 0) - coalesce(p.principal_cop, 0) as used
  from public.cards c
  left join movement_totals m on m.card_id = c.id
  left join billed_interest b on b.card_id = c.id
  left join prior_principal p on p.card_id = c.id
)
select card_id, user_id, credit_limit, used, credit_limit - used as available,
  case when credit_limit = 0 then 0 else used / credit_limit end as utilization
from balances;

-- Registration RPC -------------------------------------------------------------

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
  insert into public.transactions (user_id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count, interest_free, rate_ea_applied, category_id, merchant, note, source, prior_installments, prior_principal_paid, original_installments_count)
  values (v_user, v_card_id, v_statement_id, v_type::public.transaction_type, v_date, v_amount, v_currency::public.currency_code, v_fx_rate, v_amount_cop, v_count, v_interest_free, v_rate, v_category_id, nullif(p_payload->>'merchant', ''), nullif(p_payload->>'note', ''), 'manual', v_prior, v_prior_paid, v_original)
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

-- Edit RPC: same as before, also copying the in-progress columns --------------

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
    original_installments_count = v_new.original_installments_count
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

-- Subscription charges: USD converted to COP with cents (D48) -----------------

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
  v_cutoff := public.statement_cutoff_for(v_card.cutoff_day, p_date);
  v_statement := public.ensure_statement(v_card.id, v_cutoff);
  insert into public.transactions (user_id,card_id,statement_id,category_id,type,date,merchant,amount,currency,fx_rate,amount_cop,installments_count,subscription_id,source)
  values (v_subscription.user_id,v_card.id,v_statement,v_subscription.category_id,'purchase',p_date,v_subscription.name,v_subscription.amount,v_subscription.currency,v_rate,v_amount_cop,1,v_subscription.id,'subscription')
  on conflict (subscription_id,date) where subscription_id is not null do nothing returning id into v_created;
  if v_created is null then return 0; end if;
  if not exists (select 1 from public.transactions where subscription_id = v_subscription.id and date > p_date) then
    update public.subscriptions set last_charged_amount = v_subscription.amount where id = v_subscription.id;
  end if;
  return 1;
end;
$$;
revoke all on function public.generate_subscription_charge_on(uuid,date) from public, anon, authenticated;
