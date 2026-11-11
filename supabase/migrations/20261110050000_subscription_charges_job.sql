create extension if not exists pg_cron;

create function public.generate_subscription_charge_on(p_subscription_id uuid, p_date date)
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
    v_amount_cop := round(v_subscription.amount * v_rate);
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

create function public.generate_subscription_charges(p_today date default (now() at time zone 'America/Bogota')::date)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare v_subscription record; v_date date; v_count integer := 0;
begin
  if p_today is null then raise exception 'Fecha inválida' using errcode = '22023'; end if;
  for v_subscription in select id from public.subscriptions where status = 'active' order by id loop
    for v_date in select d::date from generate_series(p_today - 6, p_today, interval '1 day') d loop
      v_count := v_count + public.generate_subscription_charge_on(v_subscription.id, v_date);
    end loop;
  end loop;
  return v_count;
end;
$$;
revoke all on function public.generate_subscription_charges(date) from public, anon, authenticated;

create function public.generate_charges_for_subscription(p_id uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from public.subscriptions where id = p_id and user_id = auth.uid()) then
    raise exception 'Suscripción no disponible' using errcode = '42501';
  end if;
  return public.generate_subscription_charge_on(p_id, (now() at time zone 'America/Bogota')::date);
end;
$$;
revoke all on function public.generate_charges_for_subscription(uuid) from public, anon;
grant execute on function public.generate_charges_for_subscription(uuid) to authenticated;

select cron.schedule('generate-subscription-charges', '0 10 * * *', 'select public.generate_subscription_charges()');
