begin;
select no_plan();
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'changes-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'changes-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea, advance_rate_ea, advance_fee)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2, 0, 0, 15000);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
-- Compra de $600.000 a 6 cuotas sin intereses, con fechas futuras para que ninguna cuota esté facturada al correr la prueba.
select public.create_transaction_with_installments((
  select jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'type', 'purchase', 'date', '2099-01-10', 'amount', '600000', 'currency', 'COP',
    'fx_rate', null, 'amount_cop', '600000', 'installments_count', 6, 'interest_free', false, 'rate_ea_applied', '0', 'category_id', null, 'merchant', 'Nevera', 'note', '',
    'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2099-01-15' + make_interval(months => n - 1))::date, 'principal', 100000, 'interest', 0,
      'total', 100000, 'balance_after', 600000 - 100000 * n, 'principal_cop', 100000, 'interest_cop', 0, 'total_cop', 100000) order by n))
  from generate_series(1, 6) n));
select set_config('test.fridge', (select id::text from public.transactions where merchant = 'Nevera'), true);

-- A 12 cuotas restantes: 11 de $41.666,67 y la última por el resto, en los mismos extractos y los siguientes.
select set_config('test.change', (
  select jsonb_build_object('transaction_id', current_setting('test.fridge'), 'remaining_installments', 12, 'replaced_from_number', 1,
    'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2099-01-15' + make_interval(months => n - 1))::date, 'principal', principal, 'interest', 0,
      'total', principal, 'balance_after', balance, 'principal_cop', principal, 'interest_cop', 0, 'total_cop', principal) order by n))::text
  from (select n, principal, 600000 - sum(principal) over (order by n) as balance
        from (select n, case when n < 12 then 50000 else 50000 end as principal from generate_series(1, 12) n) rows) calc), true);
select lives_ok($$ select public.change_installments(current_setting('test.change')::jsonb) $$, 'cambia a 12 cuotas restantes');
select is((select count(*) from public.installments where transaction_id = current_setting('test.fridge')::uuid), 12::bigint, 'el plan tiene 12 cuotas');
select is((select sum(principal) from public.installments where transaction_id = current_setting('test.fridge')::uuid), 600000::numeric, 'con el mismo saldo');
select is((select s.cutoff_date from public.installments i join public.statements s on s.id = i.statement_id where i.transaction_id = current_setting('test.fridge')::uuid and i.number = 12),
  '2099-12-15'::date, 'las cuotas nuevas siguen en los extractos siguientes');
select results_eq($$ select remaining_installments, amount, effective_date is not null from public.principal_prepayments $$, $$ values (12::smallint, 0::numeric, true) $$,
  'guarda el cambio sin monto');
select is((select installments_count from public.transactions where id = current_setting('test.fridge')::uuid), 6::smallint, 'la compra conserva el plan registrado');

select throws_ok($$ select public.update_transaction_with_installments(current_setting('test.fridge')::uuid,
  '{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2099-01-10","amount":"600000","currency":"COP","fx_rate":null,"amount_cop":"600000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Nevera","note":"","installments":[]}'::jsonb) $$,
  '22023', 'Este movimiento tiene abonos a capital', 'una compra con cambio de cuotas no regenera su plan al editarla');

select lives_ok($$ delete from public.principal_prepayments where transaction_id = current_setting('test.fridge')::uuid $$, 'deshace el cambio');
select results_eq($$ select count(*), sum(principal) from public.installments where transaction_id = current_setting('test.fridge')::uuid $$, $$ values (6::bigint, 600000::numeric) $$,
  'vuelve al plan de 6 cuotas');

-- Rechazos
select throws_ok($$ select public.change_installments(jsonb_set(current_setting('test.change')::jsonb, '{remaining_installments}', '37')) $$, '22023', 'Elige entre 1 y 36 cuotas restantes',
  'más de 36 cuotas restantes se rechaza');
select throws_ok($$ select public.change_installments(jsonb_set(current_setting('test.change')::jsonb, '{remaining_installments}', '11')) $$, '22023', 'Cuotas del cambio inconsistentes',
  'el número de cuotas coincide con el pedido');
select throws_ok($$ select public.change_installments(jsonb_set(current_setting('test.change')::jsonb, '{installments,7,cutoff_date}', '"2099-09-14"')) $$, '22023', 'Cuotas del cambio inconsistentes',
  'las cuotas siguen los cortes de la tarjeta');
select throws_ok($$ select public.change_installments(jsonb_set(current_setting('test.change')::jsonb, '{installments,11,principal}', '"40000"')) $$, '22023', null,
  'el capital rehecho cuadra con el saldo');

-- Comisión de avance por movimiento (D41)
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2099-02-10","amount":"200000","currency":"COP","fx_rate":null,"amount_cop":"200000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Avance otro cajero","note":"","installments":[],"advance_fee":"7200.5"}'::jsonb);
select set_config('test.advance', (select id::text from public.transactions where merchant = 'Avance otro cajero'), true);
select is((select amount from public.transactions where parent_id = current_setting('test.advance')::uuid), 7200.5::numeric, 'guarda la comisión del avance');
select is((select st.cash_advances from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.cutoff_date = '2099-02-15'), 207200.5::numeric,
  'la comisión suma al extracto del avance');
select lives_ok($$ select public.update_transaction_with_installments(current_setting('test.advance')::uuid,
  '{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2099-02-10","amount":"200000","currency":"COP","fx_rate":null,"amount_cop":"200000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Avance editado","note":"","installments":[],"advance_fee":"7200.5"}'::jsonb) $$,
  'edita el avance sin cambiar la comisión');
select results_eq($$ select count(*), sum(amount) from public.transactions where parent_id = current_setting('test.advance')::uuid $$, $$ values (1::bigint, 7200.5::numeric) $$,
  'la edición conserva la comisión del avance');
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2099-02-11","amount":"100000","currency":"COP","fx_rate":null,"amount_cop":"100000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Avance tarjeta","note":"","installments":[]}'::jsonb);
select is((select c.amount from public.transactions c join public.transactions t on t.id = c.parent_id where t.merchant = 'Avance tarjeta'), 15000::numeric, 'sin comisión en el payload usa la de la tarjeta');
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2099-02-12","amount":"100000","currency":"COP","fx_rate":null,"amount_cop":"100000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Avance gratis","note":"","installments":[],"advance_fee":"0"}'::jsonb);
select is((select count(*) from public.transactions c join public.transactions t on t.id = c.parent_id where t.merchant = 'Avance gratis'), 0::bigint, 'una comisión en cero no crea el cargo');
select throws_ok($$ select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2099-02-12","amount":"100000","currency":"COP","fx_rate":null,"amount_cop":"100000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Compra","note":"","installments":[],"advance_fee":"100"}'::jsonb) $$,
  '22023', 'Comisión de avance inválida', 'solo los avances llevan comisión');
select throws_ok($$ select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2099-02-12","amount":"100000","currency":"COP","fx_rate":null,"amount_cop":"100000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Avance","note":"","installments":[],"advance_fee":"10.001"}'::jsonb) $$,
  '22023', 'Comisión de avance inválida', 'la comisión va en centavos');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$ select public.change_installments(current_setting('test.change')::jsonb) $$, '42501', null, 'otro usuario no cambia cuotas ajenas');
select * from finish();
rollback;
