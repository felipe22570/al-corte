create or replace function public.ensure_statement(p_card_id uuid, p_cutoff_date date)
returns uuid language plpgsql volatile security invoker set search_path = '' as $$
declare card public.cards%rowtype; v_statement_id uuid;
begin
  select * into strict card from public.cards where id = p_card_id;
  if public.cutoff_date_for_month(card.cutoff_day, extract(year from p_cutoff_date)::integer, extract(month from p_cutoff_date)::integer) <> p_cutoff_date then
    raise exception 'Fecha de corte inválida' using errcode = '22023';
  end if;
  insert into public.statements (user_id, card_id, period_start, cutoff_date, due_date)
  values (card.user_id, card.id, public.statement_period_start(card.cutoff_day, p_cutoff_date), p_cutoff_date, public.statement_due_date(card.payment_day, p_cutoff_date))
  on conflict (card_id, cutoff_date) do nothing;
  select id into strict v_statement_id from public.statements where card_id = p_card_id and cutoff_date = p_cutoff_date;
  if card.handling_fee > 0 then
    insert into public.transactions (user_id, card_id, statement_id, type, date, amount, amount_cop, source)
    values (card.user_id, card.id, v_statement_id, 'handling_fee', p_cutoff_date, card.handling_fee, card.handling_fee, 'system')
    on conflict (statement_id) where type = 'handling_fee' and source = 'system' do nothing;
  end if;
  return v_statement_id;
end;
$$;
