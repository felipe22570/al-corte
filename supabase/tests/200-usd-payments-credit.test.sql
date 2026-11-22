begin;
select no_plan();
insert into auth.users (id, email) values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'usd-a@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('dddddddd-0000-4000-8000-000000000001', 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'Mastercard', 'Bancolombia', 'Mastercard', '1999', 2000000, 15, 2);
-- Own TRM for the test (the daily job may have loaded real ones); rolled back at the end.
delete from public.fx_rates;
insert into public.fx_rates (date, usd_cop) values ('2026-11-20', 3300);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-4ddd-8ddd-dddddddddddd","role":"authenticated"}', true);
-- A purchase of US$154 with the TRM of its day, in the statement of November 15.
select public.create_transaction_with_installments('{"card_id":"dddddddd-0000-4000-8000-000000000001","type":"purchase","date":"2026-10-20","amount":"154","currency":"USD","fx_rate":"3200","amount_cop":"492800","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Dólares","note":"","installments":[]}');
select set_config('test.nov', (select id::text from public.statements where cutoff_date = '2026-11-15'), true);

-- D52: the debt in dollars is valued with the latest TRM, not with the one of the purchase.
select results_eq($$ select cop_used, usd_net, fx_rate, fx_estimated, used, available from public.card_balances $$,
  $$ values (0::numeric, 154::numeric, 3300.0000::numeric, false, 508200.00::numeric, 1491800.00::numeric) $$, 'cupo con la deuda en dólares a la TRM vigente');

select set_config('test.payment', jsonb_build_object('card_id', 'dddddddd-0000-4000-8000-000000000001', 'statement_id', current_setting('test.nov'), 'date', '2026-11-18',
  'amount', '154', 'currency', 'USD', 'fx_rate', '3311.6883', 'amount_cop', '510000', 'cop_debited', true, 'kind', 'other', 'note', '', 'mark_paid', false, 'prepayments', '[]'::jsonb)::text, true);
select lives_ok($$ select public.register_payment(current_setting('test.payment')::jsonb) $$, 'US$154 pagados con $510.000: tasa 3.311,6883');
select results_eq($$ select amount_cop, fx_rate, cop_debited from public.transactions where type = 'payment' $$, $$ values (510000.00::numeric, 3311.6883::numeric, true) $$, 'guarda los pesos exactos');
select results_eq($$ select usd_net, used from public.card_balances $$, $$ values (0::numeric, 0::numeric) $$, 'el pago solo libera los dólares pagados, sin diferencia cambiaria');

select lives_ok($$ select public.register_payment(current_setting('test.payment')::jsonb || '{"amount":"153.26","fx_rate":"3327.6785"}') $$,
  'US$153,26 con $510.000: la tasa redondeada deja un desfase de centavos que se acepta');
select throws_ok($$ select public.register_payment(current_setting('test.payment')::jsonb || '{"amount":"153.26","fx_rate":"3327.6785","cop_debited":false}') $$,
  '22023', 'Moneda o TRM inconsistentes', 'sin pesos debitados el equivalente sigue siendo exacto');
select throws_ok($$ select public.register_payment(current_setting('test.payment')::jsonb || '{"amount":"153.26","fx_rate":"3327.6785","amount_cop":"510100"}') $$,
  '22023', 'Moneda o TRM inconsistentes', 'fuera de la tolerancia de redondeo de la tasa');
select throws_ok($$ select public.register_payment(current_setting('test.payment')::jsonb || '{"currency":"COP","fx_rate":null,"amount":"510000","amount_cop":"510000"}') $$,
  '22023', 'Moneda o TRM inconsistentes', 'solo los pagos en dólares llevan pesos debitados');
select throws_ok($$ select public.create_transaction_with_installments('{"card_id":"dddddddd-0000-4000-8000-000000000001","type":"purchase","date":"2026-10-21","amount":"153.26","currency":"USD","fx_rate":"3327.6785","amount_cop":"510000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Desfase","note":"","installments":[]}') $$,
  '22023', 'Moneda o TRM inconsistentes', 'una compra con el mismo desfase sigue rechazada');

-- Without any TRM the credit uses the reference of each movement (D3) and says so.
reset role;
delete from public.fx_rates;
set local role authenticated;
select results_eq($$ select fx_rate, fx_estimated, used from public.card_balances $$, $$ values (null::numeric, true, (492800 - 510000 - 510000)::numeric) $$, 'sin TRM usa la de cada movimiento y lo marca');

select * from finish();
rollback;
