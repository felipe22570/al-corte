begin;
select no_plan();
insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'import-a@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
-- Compra del 15 de octubre que el banco facturó en el extracto de noviembre (corte variable, D30).
select set_config('test.border', '{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2099-10-15","amount":"44900","currency":"COP","fx_rate":null,"amount_cop":"44900","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Borde","note":"","installments":[],"statement_cutoff_override":"2099-11-15"}', true);
select lives_ok($$ select public.create_transaction_with_installments(current_setting('test.border')::jsonb) $$, 'registra un movimiento con el extracto del banco');
select results_eq($$ select s.cutoff_date, t.statement_override from public.transactions t join public.statements s on s.id = t.statement_id where t.merchant = 'Borde' $$,
  $$ values ('2099-11-15'::date, true) $$, 'queda en el extracto de noviembre y marcado');
select throws_ok($$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.border')::jsonb, '{statement_cutoff_override}', '"2099-12-15"')) $$,
  '22023', 'Extracto forzado inválido', 'solo el extracto anterior o siguiente al de R1');
select throws_ok($$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.border')::jsonb, '{statement_cutoff_override}', '"2099-11-14"')) $$,
  '22023', 'Extracto forzado inválido', 'el extracto forzado es un corte real de la tarjeta');
select throws_ok($$ select public.create_transaction_with_installments(current_setting('test.border')::jsonb || '{"installments_count":2,"installments":[{"number":1,"cutoff_date":"2099-10-15","principal":"22450","interest":"0","total":"22450","balance_after":"22450","principal_cop":"22450","interest_cop":"0","total_cop":"22450"},{"number":2,"cutoff_date":"2099-11-15","principal":"22450","interest":"0","total":"22450","balance_after":"0","principal_cop":"22450","interest_cop":"0","total_cop":"22450"}]}'::jsonb) $$,
  '22023', 'Extracto forzado inválido', 'solo movimientos de una cuota');
select lives_ok($$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.border')::jsonb, '{statement_cutoff_override}', '"2099-10-15"') || '{"merchant":"Igual"}'::jsonb) $$,
  'forzar el mismo extracto de R1 no marca el movimiento');
select is((select statement_override from public.transactions where merchant = 'Igual'), false, 'sin marca');

-- Edición: misma fecha y tarjeta conserva el extracto; otra fecha aplica R1 y quita la marca.
select lives_ok($$ select public.update_transaction_with_installments((select id from public.transactions where merchant = 'Borde'),
  (current_setting('test.border')::jsonb - 'statement_cutoff_override') || '{"merchant":"Borde editado"}'::jsonb) $$, 'edita el comercio');
select results_eq($$ select s.cutoff_date, t.statement_override from public.transactions t join public.statements s on s.id = t.statement_id where t.merchant = 'Borde editado' $$,
  $$ values ('2099-11-15'::date, true) $$, 'conserva el extracto del banco');
select lives_ok($$ select public.update_transaction_with_installments((select id from public.transactions where merchant = 'Borde editado'),
  (current_setting('test.border')::jsonb - 'statement_cutoff_override') || '{"date":"2099-10-14"}'::jsonb) $$, 'cambia la fecha');
select results_eq($$ select s.cutoff_date, t.statement_override from public.transactions t join public.statements s on s.id = t.statement_id where t.date = '2099-10-14' $$,
  $$ values ('2099-10-15'::date, false) $$, 'vuelve a R1 sin marca');

-- Plan acortado por el redondeo del banco (R2): se acepta con su N original, mayor que el plan efectivo.
select set_config('test.short', (select jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'type', 'purchase', 'date', '2099-01-10', 'amount', '1.00', 'currency', 'COP',
  'fx_rate', null, 'amount_cop', '1.00', 'installments_count', 34, 'original_installments_count', 36, 'interest_free', false, 'rate_ea_applied', '0', 'category_id', null, 'merchant', 'Mínima', 'note', '',
  'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2099-01-15' + make_interval(months => n - 1))::date, 'principal', case when n < 34 then 0.03 else 0.01 end, 'interest', 0,
    'total', case when n < 34 then 0.03 else 0.01 end, 'balance_after', greatest(1 - 0.03 * n, 0), 'principal_cop', case when n < 34 then 0.03 else 0.01 end, 'interest_cop', 0, 'total_cop', case when n < 34 then 0.03 else 0.01 end) order by n))::text
  from generate_series(1, 34) n), true);
select lives_ok($$ select public.create_transaction_with_installments(current_setting('test.short')::jsonb) $$, 'acepta un plan acortado por el redondeo');
select throws_ok($$ select public.create_transaction_with_installments(jsonb_set(current_setting('test.short')::jsonb, '{original_installments_count}', '34')) $$,
  '22023', 'Datos del movimiento inválidos', 'el N original es mayor que el plan efectivo');

-- Clave de importación única por usuario (D36).
select lives_ok($$ update public.transactions set import_key = 'visa-000001' where merchant = 'Igual' $$, 'guarda la clave de importación');
select throws_ok($$ update public.transactions set import_key = 'visa-000001' where date = '2099-10-14' $$, '23505', null, 'no se repite');
select * from finish();
rollback;
