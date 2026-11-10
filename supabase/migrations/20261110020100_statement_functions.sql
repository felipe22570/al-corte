create function public.cutoff_date_for_month(cutoff_day integer, y integer, m integer)
returns date language plpgsql immutable strict set search_path = '' as $$
declare first_day date;
begin
  if cutoff_day not between 1 and 31 then raise exception 'Día inválido' using errcode = '22023'; end if;
  first_day := pg_catalog.make_date(y, m, 1);
  return first_day + least(cutoff_day - 1, (first_day + interval '1 month - 1 day')::date - first_day);
end;
$$;

create function public.statement_cutoff_for(cutoff_day integer, d date)
returns date language plpgsql immutable strict set search_path = '' as $$
declare candidate date; next_month date;
begin
  candidate := public.cutoff_date_for_month(cutoff_day, extract(year from d)::integer, extract(month from d)::integer);
  if d <= candidate then return candidate; end if;
  next_month := (pg_catalog.date_trunc('month', d::timestamp) + interval '1 month')::date;
  return public.cutoff_date_for_month(cutoff_day, extract(year from next_month)::integer, extract(month from next_month)::integer);
end;
$$;

create function public.statement_period_start(cutoff_day integer, cutoff_date date)
returns date language plpgsql immutable strict set search_path = '' as $$
declare previous_month date;
begin
  previous_month := (pg_catalog.date_trunc('month', cutoff_date::timestamp) - interval '1 month')::date;
  return public.cutoff_date_for_month(cutoff_day, extract(year from previous_month)::integer, extract(month from previous_month)::integer) + 1;
end;
$$;

create function public.statement_due_date(payment_day integer, cutoff_date date)
returns date language plpgsql immutable strict set search_path = '' as $$
declare candidate date; next_month date;
begin
  candidate := public.cutoff_date_for_month(payment_day, extract(year from cutoff_date)::integer, extract(month from cutoff_date)::integer);
  if candidate > cutoff_date then return candidate; end if;
  next_month := (pg_catalog.date_trunc('month', cutoff_date::timestamp) + interval '1 month')::date;
  return public.cutoff_date_for_month(payment_day, extract(year from next_month)::integer, extract(month from next_month)::integer);
end;
$$;

create function public.ensure_statement(p_card_id uuid, p_cutoff_date date)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare card public.cards%rowtype; statement_id uuid;
begin
  select * into strict card from public.cards where id = p_card_id;
  if public.cutoff_date_for_month(card.cutoff_day, extract(year from p_cutoff_date)::integer, extract(month from p_cutoff_date)::integer) <> p_cutoff_date then
    raise exception 'Fecha de corte inválida' using errcode = '22023';
  end if;
  insert into public.statements (user_id, card_id, period_start, cutoff_date, due_date)
  values (card.user_id, card.id, public.statement_period_start(card.cutoff_day, p_cutoff_date), p_cutoff_date, public.statement_due_date(card.payment_day, p_cutoff_date))
  on conflict (card_id, cutoff_date) do nothing;
  select id into strict statement_id from public.statements where card_id = p_card_id and cutoff_date = p_cutoff_date;
  if card.handling_fee > 0 then
    insert into public.transactions (user_id, card_id, statement_id, type, date, amount, amount_cop, source)
    values (card.user_id, card.id, statement_id, 'handling_fee', p_cutoff_date, card.handling_fee, card.handling_fee, 'system')
    on conflict (statement_id) where type = 'handling_fee' and source = 'system' do nothing;
  end if;
  return statement_id;
end;
$$;
revoke all on function public.ensure_statement(uuid, date) from public, anon;
grant execute on function public.ensure_statement(uuid, date) to authenticated;
