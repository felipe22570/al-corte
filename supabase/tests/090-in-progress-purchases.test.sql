begin;
select no_plan();
insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'in-progress@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea, advance_rate_ea, advance_fee, handling_fee)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2, 0, 0, 15000, 30000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
-- IKEA de la Visa: $451.860 a 4 cuotas, cuota 3 de 4 en el extracto del 15 de noviembre, saldo $112.965.
select set_config('test.ikea', '{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-09-10","amount":"451860","currency":"COP","fx_rate":null,"amount_cop":"451860","installments_count":4,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"IKEA","note":"","prior_installments":2,"prior_principal_paid":"225930","original_installments_count":null,"tracked_from_cutoff":"2026-11-15","installments":[{"number":1,"cutoff_date":null,"before_tracking":true,"principal":"112965","interest":"0","total":"112965","balance_after":"338895","principal_cop":"112965","interest_cop":"0","total_cop":"112965"},{"number":2,"cutoff_date":null,"before_tracking":true,"principal":"112965","interest":"0","total":"112965","balance_after":"225930","principal_cop":"112965","interest_cop":"0","total_cop":"112965"},{"number":3,"cutoff_date":"2026-11-15","before_tracking":false,"principal":"112965","interest":"0","total":"112965","balance_after":"112965","principal_cop":"112965","interest_cop":"0","total_cop":"112965"},{"number":4,"cutoff_date":"2026-12-15","before_tracking":false,"principal":"112965","interest":"0","total":"112965","balance_after":"0","principal_cop":"112965","interest_cop":"0","total_cop":"112965"}]}', true);

select lives_ok($sql$ select public.create_transaction_with_installments(current_setting('test.ikea')::jsonb) $sql$, 'guarda una compra en curso');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id = t.statement_id where t.merchant = 'IKEA'), '2026-11-15'::date, 'el movimiento queda en el extracto de la cuota k');
select is((select count(*) from public.statements where cutoff_date < '2026-11-15'), 0::bigint, 'no crea extractos anteriores a la cuota k');
select is((select count(*) from public.transactions where type = 'handling_fee'), 2::bigint, 'cuota de manejo solo en los extractos de la cuota k en adelante');
select is((select count(*) from public.installments where before_tracking and statement_id is null and interest = 0), 2::bigint, 'dos cuotas previas sin extracto ni interés');
select is((select prior_installments from public.transactions where merchant = 'IKEA'), 2::smallint, 'guarda las cuotas previas');
select is((select prior_principal_paid from public.transactions where merchant = 'IKEA'), 225930::numeric, 'guarda el capital previo');
select is((select st.installments from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.cutoff_date = '2026-11-15'), 112965::numeric, 'el extracto solo suma la cuota k');
select is((select sum(st.installments) from public.statement_currency_totals st), 225930::numeric, 'las cuotas previas no entran en ningún extracto');
select is((select used from public.card_balances), 285930::numeric, 'el cupo cuenta solo el capital pendiente y el manejo');

select lives_ok($sql$
  select public.update_transaction_with_installments((select id from public.transactions where merchant = 'IKEA'), jsonb_set(current_setting('test.ikea')::jsonb, '{merchant}', '"IKEA editado"'))
$sql$, 'edita la compra en curso');
select is((select count(*) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'IKEA editado' and i.before_tracking), 2::bigint, 'la edición conserva las cuotas previas');
select is((select prior_principal_paid from public.transactions where merchant = 'IKEA editado'), 225930::numeric, 'la edición conserva el capital previo');

-- Avance de la Mastercard del 16 de abril: $600.000, cuota 7 de 24, saldo $269.998,46 → plan efectivo de 18.
select set_config('test.advance', (
  with rows as (
    select n, case when n <= 6 then 50833.59 when n < 18 then 25000 else 19998.46 end as principal from generate_series(1, 18) n
  ), calc as (select n, principal, 600000 - sum(principal) over (order by n) as balance from rows)
  select jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'type', 'cash_advance', 'date', '2026-04-16', 'amount', '600000', 'currency', 'COP',
    'fx_rate', null, 'amount_cop', '600000', 'installments_count', 18, 'interest_free', false, 'rate_ea_applied', '0', 'category_id', null, 'merchant', 'Avance',
    'note', '', 'prior_installments', 6, 'prior_principal_paid', '305001.54', 'original_installments_count', 24, 'tracked_from_cutoff', '2026-11-15',
    'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', case when n <= 6 then null else (date '2026-11-15' + make_interval(months => n - 7))::date end,
      'before_tracking', n <= 6, 'principal', principal, 'interest', 0, 'total', principal, 'balance_after', balance,
      'principal_cop', principal, 'interest_cop', 0, 'total_cop', principal) order by n))::text
  from calc), true);
select lives_ok($sql$ select public.create_transaction_with_installments(current_setting('test.advance')::jsonb) $sql$, 'guarda un avance en curso con abono previo');
select is((select count(*) from public.transactions where type = 'advance_fee'), 0::bigint, 'el avance en curso no genera comisión');
select is((select count(*) from public.statements where cutoff_date < '2026-11-15'), 0::bigint, 'el avance de abril no crea extractos de abril a octubre');
select is((select original_installments_count from public.transactions where merchant = 'Avance'), 24::smallint, 'conserva el N original');
select is((select s.cutoff_date from public.installments i join public.transactions t on t.id = i.transaction_id join public.statements s on s.id = i.statement_id where t.merchant = 'Avance' and i.number = 18), '2027-10-15'::date, 'la última cuota cae en el extracto consecutivo');

-- Rechazos
select throws_ok($sql$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.ikea')::jsonb, '{tracked_from_cutoff}', '"2026-11-14"')) $sql$,
  '22023', 'El corte de la cuota actual no es válido', 'el corte de la cuota k debe existir en la tarjeta');
select throws_ok($sql$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.ikea')::jsonb, '{date}', '"2026-12-01"')) $sql$,
  '22023', 'El corte de la cuota actual no es válido', 'la cuota k no puede ser anterior a la compra');
select throws_ok($sql$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.ikea')::jsonb, '{tracked_from_cutoff}', '"2100-01-15"')) $sql$,
  '22023', 'El corte de la cuota actual no es válido', 'la cuota k no puede caer después del extracto abierto');
select throws_ok($sql$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.ikea')::jsonb, '{installments,0,cutoff_date}', '"2026-09-15"')) $sql$,
  '22023', 'Cuota previa inconsistente', 'una cuota previa no tiene extracto');
select throws_ok($sql$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.ikea')::jsonb, '{prior_principal_paid}', '"225929"')) $sql$,
  '22023', 'Capital previo inconsistente', 'el capital previo coincide con las cuotas previas');
select throws_ok($sql$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.ikea')::jsonb, '{original_installments_count}', '4')) $sql$,
  '22023', 'Compra en curso inválida', 'el N original solo se guarda si difiere del plan efectivo');
select throws_ok($sql$ select public.create_transaction_with_installments(current_setting('test.ikea')::jsonb || '{"installments_count":40,"prior_installments":0,"prior_principal_paid":"0","tracked_from_cutoff":null}'::jsonb) $sql$,
  '22023', 'Datos del movimiento inválidos', 'las compras nuevas siguen limitadas a 36 cuotas');
select is((select count(*) from public.transactions where merchant like 'IKEA%'), 1::bigint, 'los rechazos no guardan nada');

-- Centavos en COP (D48)
select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-16","amount":"10.25","currency":"USD","fx_rate":"4123.57","amount_cop":"42266.59","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"USD centavos","note":"","installments":[]}'::jsonb)
$sql$, 'el equivalente COP se guarda con centavos');
select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-16","amount":"10.25","currency":"USD","fx_rate":"4123.57","amount_cop":"42267","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"USD pesos","note":"","installments":[]}'::jsonb)
$sql$, '22023', 'Moneda o TRM inconsistentes', 'rechaza el equivalente redondeado a pesos');

reset role;
insert into public.fx_rates (date, usd_cop) values ('2100-01-01', 4123.57);
insert into public.subscriptions (id, user_id, card_id, name, amount, currency, frequency, billing_day, start_date, status)
values ('aaaaaaaa-0000-4000-8000-000000000020', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', 'USD', 10.25, 'USD', 'monthly', 16, '2026-01-01', 'active');
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000020', '2026-11-16'), 1, 'genera el cobro USD');
select is((select amount_cop from public.transactions where subscription_id = 'aaaaaaaa-0000-4000-8000-000000000020'), 42266.59::numeric, 'el cobro USD se convierte con centavos');

select throws_ok($sql$
  insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
  select user_id, id, null, 9, 1, 0, 1, 0, 1, 0, 1 from public.transactions where merchant = 'Avance'
$sql$, '23514', null, 'solo una cuota previa puede no tener extracto');
select throws_ok($sql$
  insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop, before_tracking)
  select user_id, id, null, 9, 1, 1, 2, 0, 1, 1, 2, true from public.transactions where merchant = 'Avance'
$sql$, '23514', null, 'una cuota previa no lleva interés');
select throws_ok($sql$ update public.transactions set prior_principal_paid = amount where merchant = 'Avance' $sql$, '23514', null, 'el capital previo es menor que el valor');
select * from finish();
rollback;
