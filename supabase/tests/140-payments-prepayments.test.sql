begin;
select no_plan();
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'payments-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'payments-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Mastercard', 'Bancolombia', 'Mastercard', '5678', 10000000, 15, 2);

select has_column('public', 'transactions', 'paid_statement_id', 'el pago guarda el extracto que cubre');
select has_column('public', 'transactions', 'payment_kind', 'el pago guarda su tipo');
select has_column('public', 'cards', 'payment_allocation_rule', 'la tarjeta define la regla de abonos');
select is((select payment_allocation_rule::text from public.cards), 'bancolombia_priority', 'la regla por defecto es la de Bancolombia');
select is((select relrowsecurity from pg_class where oid = 'public.principal_prepayments'::regclass), true, 'abonos con RLS');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

-- Avance del 16 de abril: $600.000 a 24 cuotas de $25.000, sin intereses en la cuota.
select public.create_transaction_with_installments((
  select jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'type', 'cash_advance', 'date', '2026-04-16', 'amount', '600000', 'currency', 'COP',
    'fx_rate', null, 'amount_cop', '600000', 'installments_count', 24, 'interest_free', false, 'rate_ea_applied', '0', 'category_id', null, 'merchant', 'Avance', 'note', '',
    'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2026-05-15' + make_interval(months => n - 1))::date, 'principal', 25000, 'interest', 0,
      'total', 25000, 'balance_after', 600000 - 25000 * n, 'principal_cop', 25000, 'interest_cop', 0, 'total_cop', 25000) order by n))
  from generate_series(1, 24) n));
select set_config('test.advance', (select id::text from public.transactions where merchant = 'Avance'), true);
select set_config('test.nov', (select id::text from public.statements where cutoff_date = '2026-11-15'), true);
select is((select is_international from public.transactions where merchant = 'Avance'), false, 'un avance en pesos es nacional por defecto');

-- Pago del 18 de noviembre: mínimo de $25.000 y abono de $155.001,54 que deja $269.998,46 → 18 cuotas efectivas.
select set_config('test.payment', (
  select jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'statement_id', current_setting('test.nov'), 'date', '2026-11-18',
    'amount', '180001.54', 'currency', 'COP', 'fx_rate', null, 'amount_cop', '180001.54', 'kind', 'other', 'note', '', 'mark_paid', true,
    'prepayments', jsonb_build_array(jsonb_build_object('transaction_id', current_setting('test.advance'), 'amount', '155001.54', 'amount_cop', '155001.54',
      'effect', 'reduce_term', 'assumed', false, 'replaced_from_number', 8,
      'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2026-12-15' + make_interval(months => n - 8))::date,
        'principal', principal, 'interest', 0, 'total', principal, 'balance_after', balance, 'principal_cop', principal, 'interest_cop', 0, 'total_cop', principal) order by n))))::text
  from (select n, principal, 269998.46 - sum(principal) over (order by n) as balance
        from (select n, case when n < 18 then 25000 else 19998.46 end as principal from generate_series(8, 18) n) rows) calc), true);

select lives_ok($$ select public.register_payment(current_setting('test.payment')::jsonb) $$, 'registra el pago con su abono');
select set_config('test.payment_id', (select id::text from public.transactions where type = 'payment'), true);
select is((select count(*) from public.installments where transaction_id = current_setting('test.advance')::uuid), 18::bigint, 'reducir plazo deja 18 cuotas');
select is((select (select sum(principal) from public.installments where transaction_id = current_setting('test.advance')::uuid)
  + (select sum(amount) from public.principal_prepayments where transaction_id = current_setting('test.advance')::uuid)), 600000::numeric, 'capital de cuotas + abonos = valor');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id = t.statement_id where t.type = 'payment'), '2026-12-15'::date,
  'el pago queda en el extracto de su fecha (R1)');
select is((select paid_statement_id::text from public.transactions where type = 'payment'), current_setting('test.nov'), 'y cubre el extracto de noviembre');
select is((select payment_kind::text from public.transactions where type = 'payment'), 'other', 'guarda el tipo de pago');
select isnt((select paid_at from public.statement_balances where statement_id = current_setting('test.nov')::uuid and currency = 'COP'), null, 'marca pagado el saldo en pesos');
select results_eq($$ select total_calculated, total_debt from public.statement_currency_totals where statement_id = current_setting('test.nov')::uuid $$,
  $$ values (25000::numeric, 450000::numeric) $$, 'un pago posterior al corte no cambia el total ni la deuda de ese extracto');
select is((select total_debt from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.cutoff_date = '2026-12-15' and st.currency = 'COP'),
  269998.46::numeric, 'la deuda de diciembre ya refleja el abono');
select is((select replaced_from_number from public.principal_prepayments), 8::smallint, 'el abono guarda desde qué cuota rehízo el plan');

select throws_ok($$ select public.update_transaction_with_installments(current_setting('test.advance')::uuid,
  '{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2026-04-16","amount":"600000","currency":"COP","fx_rate":null,"amount_cop":"600000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Avance","note":"","installments":[]}'::jsonb) $$,
  '22023', 'Este movimiento tiene abonos a capital', 'una compra con abonos no regenera su plan');
select lives_ok($$ select public.update_transaction_details(current_setting('test.advance')::uuid, '{"merchant":"Avance editado","note":"nota","category_id":null}'::jsonb) $$,
  'pero sí cambia comercio y nota');
select is((select count(*) from public.installments where transaction_id = current_setting('test.advance')::uuid), 18::bigint, 'sin tocar las cuotas');

-- Un segundo pago al extracto de noviembre, un día después, liquida el saldo (pago total).
select set_config('test.total', jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'statement_id', current_setting('test.nov'), 'date', '2026-11-19',
  'amount', '269998.46', 'currency', 'COP', 'fx_rate', null, 'amount_cop', '269998.46', 'kind', 'total', 'note', '', 'mark_paid', true,
  'prepayments', jsonb_build_array(jsonb_build_object('transaction_id', current_setting('test.advance'), 'amount', '269998.46', 'amount_cop', '269998.46',
    'effect', 'reduce_term', 'assumed', false, 'replaced_from_number', 8, 'installments', '[]'::jsonb)))::text, true);
select lives_ok($$ select public.register_payment(current_setting('test.total')::jsonb) $$, 'el pago total liquida el avance');
select is((select count(*) from public.installments where transaction_id = current_setting('test.advance')::uuid), 7::bigint, 'sin cuotas futuras');
select is((select coalesce(sum(st.installments), 0) from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.cutoff_date > '2026-11-15'),
  0::numeric, 'ningún extracto futuro tiene cuotas');
select is((select total_debt from public.statement_currency_totals where statement_id = current_setting('test.nov')::uuid), 450000::numeric, 'la deuda de noviembre se conserva');

-- LIFO: el primer pago no se puede borrar mientras exista el abono posterior.
select throws_ok($$ delete from public.transactions where id = current_setting('test.payment_id')::uuid $$, '23514', 'Borra primero el pago más reciente de esa compra',
  'solo se deshace el abono más reciente');
select lives_ok($$ delete from public.transactions where type = 'payment' and payment_kind = 'total' $$, 'borra el pago total');
select is((select count(*) from public.installments where transaction_id = current_setting('test.advance')::uuid), 18::bigint, 'restaura las cuotas que reemplazó');
select lives_ok($$ delete from public.transactions where id = current_setting('test.payment_id')::uuid $$, 'borra el primer pago');
select is((select count(*) from public.installments where transaction_id = current_setting('test.advance')::uuid), 24::bigint, 'vuelve al plan original de 24 cuotas');
select is((select sum(principal) from public.installments where transaction_id = current_setting('test.advance')::uuid), 600000::numeric, 'con todo el capital');
select is((select s.cutoff_date from public.installments i join public.statements s on s.id = i.statement_id where i.transaction_id = current_setting('test.advance')::uuid and i.number = 24),
  '2028-04-15'::date, 'en los mismos extractos');
select is((select count(*) from public.principal_prepayments), 0::bigint, 'sin abonos');
select isnt((select paid_at from public.statement_balances where statement_id = current_setting('test.nov')::uuid and currency = 'COP'), null, 'borrar el pago no quita la marca (D26)');

-- Compra de una cuota sin facturar: el abono baja el cargo en su extracto.
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-17","amount":"50000","currency":"COP","fx_rate":null,"amount_cop":"50000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Una cuota","note":"","installments":[]}'::jsonb);
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-10","amount":"40000","currency":"COP","fx_rate":null,"amount_cop":"40000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Facturada","note":"","installments":[]}'::jsonb);
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-10","amount":"10","currency":"USD","fx_rate":"4000","amount_cop":"40000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Dólares","note":"","installments":[]}'::jsonb);
select is((select is_international from public.transactions where merchant = 'Dólares'), true, 'una compra en dólares es internacional por defecto');
select set_config('test.single', jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'statement_id', current_setting('test.nov'), 'date', '2026-11-18',
  'amount', '20000', 'currency', 'COP', 'fx_rate', null, 'amount_cop', '20000', 'kind', 'other', 'note', '', 'mark_paid', false,
  'prepayments', jsonb_build_array(jsonb_build_object('transaction_id', (select id from public.transactions where merchant = 'Una cuota'), 'amount', '20000', 'amount_cop', '20000',
    'effect', 'reduce_term', 'assumed', false, 'replaced_from_number', null, 'installments', null)))::text, true);
select lives_ok($$ select public.register_payment(current_setting('test.single')::jsonb) $$, 'abona a una compra de una cuota sin facturar');
select is((select single_purchases from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.cutoff_date = '2026-12-15' and st.currency = 'COP'),
  30000::numeric, 'el cargo baja en su extracto');

-- Rechazos
select throws_ok($$ select public.register_payment(jsonb_set(current_setting('test.single')::jsonb, '{prepayments,0,transaction_id}', to_jsonb((select id from public.transactions where merchant = 'Facturada')))) $$,
  '22023', 'Abono inválido', 'una compra de una cuota ya facturada no recibe abonos');
select throws_ok($$ select public.register_payment(jsonb_set(current_setting('test.single')::jsonb, '{prepayments,0,transaction_id}', to_jsonb((select id from public.transactions where merchant = 'Dólares')))) $$,
  '22023', 'La compra del abono no está disponible', 'un pago en pesos nunca se aplica a un saldo en dólares');
select throws_ok($$ select public.register_payment(jsonb_set(jsonb_set(current_setting('test.single')::jsonb, '{prepayments,0,amount}', '"40000"'), '{prepayments,0,amount_cop}', '"40000"')) $$,
  '22023', 'Abono inconsistente', 'el abono no supera el saldo pendiente');
select throws_ok($$ select public.register_payment(jsonb_set(jsonb_set(current_setting('test.single')::jsonb, '{amount}', '"10000"'), '{amount_cop}', '"10000"')) $$,
  '22023', 'Los abonos superan el pago', 'los abonos no superan el pago');
select throws_ok($$ select public.register_payment(jsonb_set(current_setting('test.single')::jsonb, '{date}', '"2026-11-15"')) $$,
  '22023', 'Fecha de pago inválida', 'el pago es posterior al corte que cubre');
select throws_ok($$ select public.register_payment(jsonb_set(current_setting('test.payment')::jsonb, '{prepayments,0,installments,0,balance_after}', '"1"')) $$,
  '22023', 'Saldo de cuota inconsistente', 'las cuotas nuevas encadenan el saldo');
select throws_ok($$ select public.register_payment(jsonb_set(current_setting('test.payment')::jsonb, '{prepayments,0,installments,10,principal}', '"19998.45"')) $$,
  '22023', null, 'el capital rehecho cuadra con el valor');
select throws_ok($$ select public.register_payment(jsonb_set(current_setting('test.payment')::jsonb, '{prepayments,0,replaced_from_number}', '7')) $$,
  '22023', 'Abono inconsistente', 'no se rehacen cuotas ya facturadas');
select throws_ok($$ insert into public.transactions (card_id, statement_id, type, date, amount, amount_cop, payment_kind, paid_statement_id)
  values ('aaaaaaaa-0000-4000-8000-000000000001', current_setting('test.nov')::uuid, 'purchase', '2026-11-10', 1, 1, 'minimum', current_setting('test.nov')::uuid) $$,
  '23514', null, 'solo un pago tiene tipo y extracto cubierto');

-- Borrar una compra con abonos borra sus abonos sin restaurar nada.
select lives_ok($$ delete from public.transactions where merchant = 'Una cuota' $$, 'borra una compra con abonos');
select is((select count(*) from public.principal_prepayments), 0::bigint, 'y sus abonos');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$ select public.register_payment(current_setting('test.payment')::jsonb) $$, '42501', null, 'otro usuario no registra pagos en una tarjeta ajena');
select * from finish();
rollback;
