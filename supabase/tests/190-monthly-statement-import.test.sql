begin;
select no_plan();
insert into auth.users (id, email) values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'monthly-a@example.com'), ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'monthly-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('bbbbbbbb-0000-4000-8000-000000000001', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Visa', 'Bancolombia', 'Visa', '4321', 10000000, 15, 2),
       ('cccccccc-0000-4000-8000-000000000001', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'Otra', 'Bancolombia', 'Visa', '9999', 10000000, 15, 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
-- A purchase registered by hand, to link it with "Es el mismo".
select public.create_transaction_with_installments('{"card_id":"bbbbbbbb-0000-4000-8000-000000000001","type":"purchase","date":"2099-11-03","amount":"25000","currency":"COP","fx_rate":null,"amount_cop":"25000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Mercado a mano","note":"","installments":[]}');
select set_config('test.payload', '{
  "create":[{"key":"dic-1","payload":{"card_id":"bbbbbbbb-0000-4000-8000-000000000001","type":"purchase","date":"2099-11-20","amount":"44900","currency":"COP","fx_rate":null,"amount_cop":"44900","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Netflix","note":"","installments":[]},"fee":null}],
  "link":[{"transaction_id":"' || (select id from public.transactions where merchant = 'Mercado a mano') || '","key":"dic-2"}],
  "statements":[{"card_id":"bbbbbbbb-0000-4000-8000-000000000001","cutoff_date":"2099-12-15","balances":[{"currency":"COP","real_minimum":"69900","real_total":"69900"}]}]
}', true);

select is((select public.import_statement_file(current_setting('test.payload')::jsonb, true)->'statements'->0->>'minimum'), '44900.00', 'la vista previa calcula el pago mínimo con lo importado');
select is((select count(*) from public.transactions where merchant = 'Netflix'), 0::bigint, 'la vista previa no deja movimientos');
select is((select count(*) from public.transactions where import_key is not null), 0::bigint, 'ni claves');
select is((select count(*) from public.statement_balances), 0::bigint, 'ni valores del banco');

select is((select public.import_statement_file(current_setting('test.payload')::jsonb, false) - 'statements'), '{"created":1,"linked":1,"dry_run":false}'::jsonb, 'guarda y enlaza');
select results_eq($$ select merchant, source::text, import_key from public.transactions where import_key is not null order by import_key $$,
  $$ values ('Netflix', 'import', 'dic-1'), ('Mercado a mano', 'manual', 'dic-2') $$, 'el enlazado solo recibe la clave; conserva su origen');
select is((select amount from public.transactions where import_key = 'dic-2'), 25000.00::numeric, 'y su valor');
select results_eq($$ select real_minimum, real_total from public.statement_balances $$, $$ values (69900.00::numeric, 69900.00::numeric) $$, 'guarda los valores del banco');

select is((select public.import_statement_file(current_setting('test.payload')::jsonb, false) - 'statements'), '{"created":0,"linked":0,"dry_run":false}'::jsonb, 'importar el mismo archivo otra vez no duplica');
select is((select count(*) from public.transactions where merchant = 'Netflix'), 1::bigint, 'un solo movimiento');

update public.statement_balances set real_minimum = 70000, real_total = null;
select public.import_statement_file(current_setting('test.payload')::jsonb, false);
select results_eq($$ select real_minimum, real_total from public.statement_balances $$, $$ values (70000.00::numeric, 69900.00::numeric) $$, 'solo llena los valores del banco vacíos');

select throws_ok($$ select public.import_statement_file('{"create":{}}', true) $$, '22023', 'Importación inválida', 'rechaza una importación mal formada');
select throws_like($$ select public.import_statement_file(jsonb_set(current_setting('test.payload')::jsonb, '{create,0}', '{"key":"dic-3","payload":{"card_id":"bbbbbbbb-0000-4000-8000-000000000001","type":"purchase","date":"2099-11-21","amount":"-1"},"fee":null}'), false) $$,
  'dic-3: %', 'un movimiento inválido rechaza todo e indica su clave');
select is((select count(*) from public.transactions where import_key = 'dic-3'), 0::bigint, 'sin guardar nada');

-- Another owner can neither link nor import into these cards.
select set_config('request.jwt.claims', '{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}', true);
select is((select public.import_statement_file(jsonb_build_object('create', '[]'::jsonb, 'statements', '[]'::jsonb, 'link',
  jsonb_build_array(jsonb_build_object('transaction_id', (select id from public.transactions where merchant = 'Netflix' limit 1), 'key', 'ajena'))), false)->>'linked'), '0', 'no enlaza movimientos ajenos');
select throws_ok($$ select public.import_statement_file(jsonb_build_object('create', '[]'::jsonb, 'link', '[]'::jsonb, 'statements', '[{"card_id":"bbbbbbbb-0000-4000-8000-000000000001","cutoff_date":"2099-12-15","balances":[]}]'::jsonb), false) $$,
  '42501', 'Tarjeta no disponible', 'ni escribe en extractos ajenos');

reset role;
select ok(not has_function_privilege('anon', 'public.import_statement_file(jsonb, boolean)', 'execute'), 'anon no la ejecuta');
select * from finish();
rollback;
