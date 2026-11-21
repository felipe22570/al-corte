begin;
select no_plan();
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'close-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'close-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea, advance_rate_ea, interest_mode)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2, 0.2899, 0.2899, 'on_balance');

select has_column('public', 'statement_balances', 'reconciled_at', 'el extracto guarda su conciliación por moneda');
select has_column('public', 'principal_prepayments', 'bank_balance', 'las correcciones guardan el saldo del banco');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
-- Nevera del 10 de octubre: $600.000 a 6 cuotas de capital; al corte del 15 de noviembre quedan $400.000.
select public.create_transaction_with_installments((
  select jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'type', 'purchase', 'date', '2026-10-10', 'amount', '600000', 'currency', 'COP',
    'fx_rate', null, 'amount_cop', '600000', 'installments_count', 6, 'interest_free', false, 'rate_ea_applied', '0.2899', 'category_id', null, 'merchant', 'Nevera', 'note', '',
    'installments', jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2026-10-15' + make_interval(months => n - 1))::date, 'principal', 100000, 'interest', 0,
      'total', 100000, 'balance_after', 600000 - 100000 * n, 'principal_cop', 100000, 'interest_cop', 0, 'total_cop', 100000) order by n))
  from generate_series(1, 6) n));
select set_config('test.fridge', (select id::text from public.transactions where merchant = 'Nevera'), true);
select set_config('test.nov', (select id::text from public.statements where cutoff_date = '2026-11-15'), true);
select set_config('test.dec', (select id::text from public.statements where cutoff_date = '2026-12-15'), true);

-- Cierre con valores del banco, intereses, mora y tasa vigente.
select lives_ok($$ select public.close_statement(jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP', 'real_minimum', '121500', 'real_total', '521500',
  'rate_ea', '0.283288', 'interest', '20000', 'late_interest', '1500', 'reconcile', true)) $$, 'cierra el extracto de noviembre');
select results_eq($$ select real_minimum, real_total, rate_ea, reconciled_at is not null from public.statement_balances where statement_id = current_setting('test.nov')::uuid and currency = 'COP' $$,
  $$ values (121500::numeric, 521500::numeric, 0.283288::numeric, true) $$, 'guarda los valores del banco y la conciliación');
select is((select purchase_rate_ea from public.cards), 0.283288::numeric(9,6), 'la tasa vigente queda para compras nuevas');
select is((select rate_ea_applied from public.transactions where merchant = 'Nevera'), 0.2899::numeric(9,6), 'las compras existentes conservan su tasa');
select results_eq($$ select type::text, amount, date from public.transactions where statement_id = current_setting('test.nov')::uuid and type in ('interest', 'late_interest') order by type $$,
  $$ values ('interest', 20000::numeric, '2026-11-15'::date), ('late_interest', 1500::numeric, '2026-11-15'::date) $$, 'registra intereses y mora en la fecha de corte');
select is((select interest from public.statement_currency_totals where statement_id = current_setting('test.nov')::uuid), 21500::numeric, 'la mora suma como intereses');

select lives_ok($$ select public.close_statement(jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP', 'real_minimum', '121500', 'real_total', '521500',
  'interest', '21000', 'late_interest', '0')) $$, 'corrige los intereses');
select results_eq($$ select type::text, amount from public.transactions where statement_id = current_setting('test.nov')::uuid and type in ('interest', 'late_interest') $$,
  $$ values ('interest', 21000::numeric) $$, 'actualiza el interés y quita la mora en cero');
select isnt((select reconciled_at from public.statement_balances where statement_id = current_setting('test.nov')::uuid), null, 'guardar sin conciliar conserva la conciliación');

-- Saldo del banco menor: misma cuota, menos capital pendiente en las cuotas siguientes.
select set_config('test.lower', jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP', 'real_minimum', '121500', 'real_total', '521500',
  'corrections', jsonb_build_array(jsonb_build_object('transaction_id', current_setting('test.fridge'), 'bank_balance', '350000', 'amount', '50000', 'amount_cop', '50000',
    'replaced_from_number', 3, 'installments', jsonb_build_array(
      jsonb_build_object('number', 3, 'cutoff_date', '2026-12-15', 'principal', '100000', 'interest', '0', 'total', '100000', 'balance_after', '250000', 'principal_cop', '100000', 'interest_cop', '0', 'total_cop', '100000'),
      jsonb_build_object('number', 4, 'cutoff_date', '2027-01-15', 'principal', '100000', 'interest', '0', 'total', '100000', 'balance_after', '150000', 'principal_cop', '100000', 'interest_cop', '0', 'total_cop', '100000'),
      jsonb_build_object('number', 5, 'cutoff_date', '2027-02-15', 'principal', '100000', 'interest', '0', 'total', '100000', 'balance_after', '50000', 'principal_cop', '100000', 'interest_cop', '0', 'total_cop', '100000'),
      jsonb_build_object('number', 6, 'cutoff_date', '2027-03-15', 'principal', '50000', 'interest', '0', 'total', '50000', 'balance_after', '0', 'principal_cop', '50000', 'interest_cop', '0', 'total_cop', '50000')))))::text, true);
select lives_ok($$ select public.close_statement(current_setting('test.lower')::jsonb) $$, 'corrige con un saldo del banco menor');
select is((select sum(principal) from public.installments where transaction_id = current_setting('test.fridge')::uuid) + (select sum(amount) from public.principal_prepayments), 600000::numeric,
  'capital de cuotas + correcciones = valor');
select is((select total_debt from public.statement_currency_totals where statement_id = current_setting('test.nov')::uuid), 471000::numeric, 'la deuda del extracto es la del banco');
select is((select total_debt from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.cutoff_date = '2026-10-15'), 600000::numeric,
  'la deuda de un extracto anterior se conserva');

-- Saldo del banco mayor: reemplaza la corrección anterior y alarga el plan con la misma cuota.
select set_config('test.higher', jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP',
  'corrections', jsonb_build_array(jsonb_build_object('transaction_id', current_setting('test.fridge'), 'bank_balance', '450000', 'amount', '-50000', 'amount_cop', '-50000',
    'replaced_from_number', 3, 'installments', (
      select jsonb_agg(jsonb_build_object('number', n, 'cutoff_date', (date '2026-12-15' + make_interval(months => n - 3))::date, 'principal', case when n < 7 then 100000 else 50000 end,
        'interest', 0, 'total', case when n < 7 then 100000 else 50000 end, 'balance_after', greatest(450000 - 100000 * (n - 2), 0), 'principal_cop', case when n < 7 then 100000 else 50000 end,
        'interest_cop', 0, 'total_cop', case when n < 7 then 100000 else 50000 end) order by n) from generate_series(3, 7) n))))::text, true);
select lives_ok($$ select public.close_statement(current_setting('test.higher')::jsonb) $$, 'reemplaza la corrección con un saldo del banco mayor');
select is((select count(*) from public.installments where transaction_id = current_setting('test.fridge')::uuid), 7::bigint, 'el plan pasa a 7 cuotas');
select is((select s.cutoff_date from public.installments i join public.statements s on s.id = i.statement_id where i.transaction_id = current_setting('test.fridge')::uuid and i.number = 7),
  '2027-04-15'::date, 'la cuota nueva cae en el extracto siguiente');
select results_eq($$ select bank_balance, amount from public.principal_prepayments $$, $$ values (450000::numeric, -50000::numeric) $$, 'una sola corrección por extracto y compra');

select lives_ok($$ select public.close_statement(jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP', 'remove_corrections', jsonb_build_array(current_setting('test.fridge')))) $$,
  'quita la corrección');
select results_eq($$ select count(*), sum(principal) from public.installments where transaction_id = current_setting('test.fridge')::uuid $$, $$ values (6::bigint, 600000::numeric) $$,
  'vuelve al plan original');

select lives_ok($$ select public.reopen_statement(current_setting('test.nov')::uuid, 'COP') $$, 'reabre el extracto');
select results_eq($$ select reconciled_at is null, real_minimum from public.statement_balances where statement_id = current_setting('test.nov')::uuid $$, $$ values (true, 121500::numeric) $$,
  'reabrir quita la marca sin borrar los valores del banco');

-- Rechazos
select throws_ok($$ select public.close_statement(jsonb_build_object('statement_id', current_setting('test.dec'), 'currency', 'COP')) $$, '22023', 'El extracto aún no ha cortado',
  'solo se cierran extractos cortados');
select throws_ok($$ select public.close_statement(jsonb_set(current_setting('test.lower')::jsonb, '{corrections,0,amount}', '"40000"')) $$, '22023', 'Saldo del banco inconsistente',
  'la corrección es la diferencia con el saldo calculado');
select throws_ok($$ select public.close_statement(jsonb_set(current_setting('test.lower')::jsonb, '{corrections,0,installments,1,cutoff_date}', '"2027-02-15"')) $$, '22023', 'Cuotas del saldo inconsistentes',
  'las cuotas rehechas siguen en sus extractos');
select throws_ok($$ select public.close_statement(jsonb_set(current_setting('test.lower')::jsonb, '{corrections,0,installments,3,principal}', '"40000"')) $$, '22023', null,
  'el capital rehecho cuadra con el saldo del banco');

-- Un abono posterior al corte bloquea cambiar el saldo hasta borrarlo (último en entrar, primero en salir).
select lives_ok($$ select public.close_statement(current_setting('test.lower')::jsonb) $$, 'vuelve a corregir');
select lives_ok($$ select public.register_payment(jsonb_build_object('card_id', 'aaaaaaaa-0000-4000-8000-000000000001', 'statement_id', current_setting('test.nov'), 'date', '2026-11-20',
  'amount', '10000', 'currency', 'COP', 'fx_rate', null, 'amount_cop', '10000', 'kind', 'other', 'note', '', 'mark_paid', false,
  'prepayments', jsonb_build_array(jsonb_build_object('transaction_id', current_setting('test.fridge'), 'amount', '10000', 'amount_cop', '10000', 'effect', 'reduce_term', 'assumed', false,
    'replaced_from_number', 3, 'installments', jsonb_build_array(
      jsonb_build_object('number', 3, 'cutoff_date', '2026-12-15', 'principal', '100000', 'interest', '0', 'total', '100000', 'balance_after', '240000', 'principal_cop', '100000', 'interest_cop', '0', 'total_cop', '100000'),
      jsonb_build_object('number', 4, 'cutoff_date', '2027-01-15', 'principal', '100000', 'interest', '0', 'total', '100000', 'balance_after', '140000', 'principal_cop', '100000', 'interest_cop', '0', 'total_cop', '100000'),
      jsonb_build_object('number', 5, 'cutoff_date', '2027-02-15', 'principal', '100000', 'interest', '0', 'total', '100000', 'balance_after', '40000', 'principal_cop', '100000', 'interest_cop', '0', 'total_cop', '100000'),
      jsonb_build_object('number', 6, 'cutoff_date', '2027-03-15', 'principal', '40000', 'interest', '0', 'total', '40000', 'balance_after', '0', 'principal_cop', '40000', 'interest_cop', '0', 'total_cop', '40000')))))) $$,
  'registra un abono después de la corrección');
select throws_ok($$ select public.close_statement(jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP', 'remove_corrections', jsonb_build_array(current_setting('test.fridge')))) $$,
  '23514', 'Borra primero el pago más reciente de esa compra', 'no deshace la corrección con un abono posterior');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($$ select public.close_statement(jsonb_build_object('statement_id', current_setting('test.nov'), 'currency', 'COP')) $$, '42501', null, 'otro usuario no cierra extractos ajenos');
select throws_ok($$ select public.reopen_statement(current_setting('test.nov')::uuid, 'COP') $$, '42501', null, 'ni los reabre');
select * from finish();
rollback;
