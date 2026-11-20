-- Step 31 (H10): deferred subscriptions and USD default installments (F13, R8, D34, D35).

alter table public.cards
  add column usd_default_installments smallint not null default 1 check (usd_default_installments between 1 and 36);
comment on column public.cards.usd_default_installments is 'Installments the bank uses by default for USD purchases (D34): 36 at Bancolombia.';

alter table public.subscriptions
  add column installments_count smallint not null default 1 check (installments_count between 1 and 36),
  -- With fixed principal, every installment but the last is round(amount / N, 2); the last one must stay positive.
  add constraint subscriptions_installments_amount_check check (
    installments_count = 1 or (round(amount / installments_count, 2) > 0 and round(amount / installments_count, 2) * (installments_count - 1) < amount)
  );
comment on column public.subscriptions.installments_count is 'Each charge is registered as a purchase in this many installments (D35).';

-- Installment plan in SQL, the same as buildInstallmentPlan in lib/domain/installments.ts (R2, D3, D32, D48).
-- Parity is checked against shared fixtures in Vitest and pgTAP. Returns the payload rows of the registration RPC.
create function private.build_installment_rows(
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
  v_first_cutoff := public.statement_cutoff_for(p_cutoff_day, p_date);
  for v_index in 1..p_count loop
    v_interest := round(v_balance * v_rate, 2);
    v_principal := case when v_index = p_count then v_balance when v_payment is not null then v_payment - v_interest else v_regular end;
    v_balance := v_balance - v_principal;
    if v_principal < 0 or v_balance < 0 then
      raise exception 'El valor es muy pequeño para esa cantidad de cuotas.' using errcode = '22023';
    end if;
    if p_currency = 'COP' then
      v_principal_cop := v_principal;
      v_interest_cop := v_interest;
    else
      v_principal_cop := case when v_index = p_count then v_amount_cop - v_sum_principal_cop else round(v_principal * p_fx_rate, 2) end;
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

-- Subscription charges: each charge is a purchase in the subscription's installments (D35), idempotent by (subscription_id, date).
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
  insert into public.transactions (user_id,card_id,statement_id,category_id,type,date,merchant,amount,currency,fx_rate,amount_cop,installments_count,rate_ea_applied,subscription_id,source)
  values (v_subscription.user_id,v_card.id,v_statement,v_subscription.category_id,'purchase',p_date,v_subscription.name,v_subscription.amount,v_subscription.currency,v_rate,v_amount_cop,
    v_subscription.installments_count, case when v_subscription.installments_count > 1 then v_card.purchase_rate_ea end, v_subscription.id,'subscription')
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
