begin;
select no_plan();
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'balances-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'balances-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2);

select hasnt_column('public', 'statements', 'paid_at', 'la marca de pago vive solo en statement_balances');
select hasnt_column('public', 'statements', 'real_total', 'el total del banco vive solo en statement_balances');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
-- $400.000 a 4 cuotas en enero, $200.000 a 2 cuotas en febrero y US$10 a 2 cuotas en enero, todo sin intereses.
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-10","amount":"400000","currency":"COP","fx_rate":null,"amount_cop":"400000","installments_count":4,"interest_free":true,"rate_ea_applied":"0","category_id":null,"merchant":"Cuatro","note":"","installments":[{"number":1,"cutoff_date":"2026-01-15","principal":"100000","interest":"0","total":"100000","balance_after":"300000","principal_cop":"100000","interest_cop":"0","total_cop":"100000"},{"number":2,"cutoff_date":"2026-02-15","principal":"100000","interest":"0","total":"100000","balance_after":"200000","principal_cop":"100000","interest_cop":"0","total_cop":"100000"},{"number":3,"cutoff_date":"2026-03-15","principal":"100000","interest":"0","total":"100000","balance_after":"100000","principal_cop":"100000","interest_cop":"0","total_cop":"100000"},{"number":4,"cutoff_date":"2026-04-15","principal":"100000","interest":"0","total":"100000","balance_after":"0","principal_cop":"100000","interest_cop":"0","total_cop":"100000"}]}'::jsonb);
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-02-10","amount":"200000","currency":"COP","fx_rate":null,"amount_cop":"200000","installments_count":2,"interest_free":true,"rate_ea_applied":"0","category_id":null,"merchant":"Dos","note":"","installments":[{"number":1,"cutoff_date":"2026-02-15","principal":"100000","interest":"0","total":"100000","balance_after":"100000","principal_cop":"100000","interest_cop":"0","total_cop":"100000"},{"number":2,"cutoff_date":"2026-03-15","principal":"100000","interest":"0","total":"100000","balance_after":"0","principal_cop":"100000","interest_cop":"0","total_cop":"100000"}]}'::jsonb);
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-10","amount":"10","currency":"USD","fx_rate":"4000","amount_cop":"40000","installments_count":2,"interest_free":true,"rate_ea_applied":"0","category_id":null,"merchant":"Dólares","note":"","installments":[{"number":1,"cutoff_date":"2026-01-15","principal":"5","interest":"0","total":"5","balance_after":"5","principal_cop":"20000","interest_cop":"0","total_cop":"20000"},{"number":2,"cutoff_date":"2026-02-15","principal":"5","interest":"0","total":"5","balance_after":"0","principal_cop":"20000","interest_cop":"0","total_cop":"20000"}]}'::jsonb);
select set_config('test.jan', (select id::text from public.statements where cutoff_date = '2026-01-15'), true);
select set_config('test.feb', (select id::text from public.statements where cutoff_date = '2026-02-15'), true);

select results_eq($$ select total_calculated, pending_principal, total_debt from public.statement_currency_totals where statement_id = current_setting('test.jan')::uuid and currency = 'COP' $$,
  $$ values (100000::numeric, 300000::numeric, 400000::numeric) $$, 'enero en pesos: pago mínimo, capital pendiente y deuda total');
select results_eq($$ select total_calculated, pending_principal, total_debt from public.statement_currency_totals where statement_id = current_setting('test.feb')::uuid and currency = 'COP' $$,
  $$ values (200000::numeric, 300000::numeric, 500000::numeric) $$, 'febrero suma la compra nueva y no cuenta compras posteriores al corte');
select results_eq($$ select total_calculated, pending_principal, total_debt, total_cop from public.statement_currency_totals where statement_id = current_setting('test.jan')::uuid and currency = 'USD' $$,
  $$ values (5::numeric, 5::numeric, 10::numeric, 20000::numeric) $$, 'enero en dólares, aparte de los pesos (D33)');
select is((select has_charges from public.statement_currency_totals where statement_id = current_setting('test.feb')::uuid and currency = 'USD'), true, 'febrero tiene cargos en dólares');

select lives_ok($$ insert into public.statement_balances (statement_id, currency, real_minimum, real_total, paid_at) values (current_setting('test.jan')::uuid, 'COP', 100000, 400000, '2026-02-01T05:00:00Z') $$, 'marca pagado el saldo en pesos');
select is((select count(*) from public.statement_balances where statement_id = current_setting('test.jan')::uuid and currency = 'USD' and paid_at is not null), 0::bigint, 'marcar pesos no marca dólares');
select throws_ok($$ insert into public.statement_balances (statement_id, currency) values (current_setting('test.jan')::uuid, 'COP') $$, '23505', null, 'una fila por extracto y moneda');
select throws_ok($$ update public.statement_balances set real_total = -1 $$, '23514', null, 'el total del banco no es negativo');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*) from public.statement_balances), 0::bigint, 'otro usuario no ve los saldos');
select throws_ok($$ insert into public.statement_balances (statement_id, currency, paid_at) values (current_setting('test.jan')::uuid, 'USD', now()) $$, '23503', null, 'otro usuario no puede marcar un extracto ajeno');
select is((select count(*) from public.statement_currency_totals), 0::bigint, 'la vista no expone extractos ajenos');
select * from finish();
rollback;
