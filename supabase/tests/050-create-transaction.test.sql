begin;
select no_plan();
insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'transaction-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'transaction-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, advance_fee)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Banco', 'Visa', '1234', 10000000, 15, 5, 15000);
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea)
values ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'USD', 'Banco', 'Visa', '5678', 10000000, 15, 5, 0.28);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);

select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-20","amount":"6000","currency":"COP","fx_rate":null,"amount_cop":"6000","installments_count":6,"interest_free":true,"rate_ea_applied":"0","category_id":null,"merchant":"Compra","note":"","installments":[{"number":1,"cutoff_date":"2026-02-15","principal":"1000","interest":"0","total":"1000","balance_after":"5000","principal_cop":"1000","interest_cop":"0","total_cop":"1000"},{"number":2,"cutoff_date":"2026-03-15","principal":"1000","interest":"0","total":"1000","balance_after":"4000","principal_cop":"1000","interest_cop":"0","total_cop":"1000"},{"number":3,"cutoff_date":"2026-04-15","principal":"1000","interest":"0","total":"1000","balance_after":"3000","principal_cop":"1000","interest_cop":"0","total_cop":"1000"},{"number":4,"cutoff_date":"2026-05-15","principal":"1000","interest":"0","total":"1000","balance_after":"2000","principal_cop":"1000","interest_cop":"0","total_cop":"1000"},{"number":5,"cutoff_date":"2026-06-15","principal":"1000","interest":"0","total":"1000","balance_after":"1000","principal_cop":"1000","interest_cop":"0","total_cop":"1000"},{"number":6,"cutoff_date":"2026-07-15","principal":"1000","interest":"0","total":"1000","balance_after":"0","principal_cop":"1000","interest_cop":"0","total_cop":"1000"}]}'::jsonb)
$sql$, 'guarda la compra y sus cuotas');
select is((select count(*) from public.transactions where type = 'purchase'), 1::bigint, 'una compra');
select is((select count(*) from public.installments), 6::bigint, 'seis cuotas');
select is((select count(*) from public.statements), 6::bigint, 'seis extractos');
select is((select sum(principal) from public.installments), 6000::numeric, 'suma exacta del capital');

select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"cash_advance","date":"2026-01-20","amount":"500000","currency":"COP","fx_rate":null,"amount_cop":"500000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"","note":"","installments":[]}'::jsonb)
$sql$, 'guarda un avance');
select is((select count(*) from public.transactions where type = 'advance_fee' and amount = 15000), 1::bigint, 'comisión del avance');
select ok((select child.statement_id = parent.statement_id from public.transactions child join public.transactions parent on parent.id = child.parent_id where child.type = 'advance_fee'), 'comisión enlazada al avance y al mismo extracto');

select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2027-01-20","amount":"100","currency":"COP","fx_rate":null,"amount_cop":"100","installments_count":2,"interest_free":true,"rate_ea_applied":"0","category_id":null,"merchant":"","note":"","installments":[{"number":1,"cutoff_date":"2027-02-15","principal":"50","interest":"0","total":"50","balance_after":"50","principal_cop":"50","interest_cop":"0","total_cop":"50"},{"number":2,"cutoff_date":"2027-03-15","principal":"49","interest":"0","total":"49","balance_after":"1","principal_cop":"49","interest_cop":"0","total_cop":"49"}]}'::jsonb)
$sql$, '22023', null, 'rechaza un plan con capital incompleto');
select is((select count(*) from public.statements where cutoff_date >= '2027-01-01'), 0::bigint, 'error revierte extractos');

select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000002","type":"purchase","date":"2026-01-20","amount":"100","currency":"USD","fx_rate":"4000","amount_cop":"400000","installments_count":3,"interest_free":false,"rate_ea_applied":"0.28","category_id":null,"merchant":"USD","note":"","installments":[{"number":1,"cutoff_date":"2026-02-15","principal":"33.33","interest":"2.08","total":"35.41","balance_after":"66.67","principal_cop":"133320","interest_cop":"8320","total_cop":"141640"},{"number":2,"cutoff_date":"2026-03-15","principal":"33.33","interest":"1.39","total":"34.72","balance_after":"33.34","principal_cop":"133320","interest_cop":"5560","total_cop":"138880"},{"number":3,"cutoff_date":"2026-04-15","principal":"33.34","interest":"0.69","total":"34.03","balance_after":"0","principal_cop":"133360","interest_cop":"2760","total_cop":"136120"}]}'::jsonb)
$sql$, 'guarda compra USD y su plan en ambas monedas');
select is((select total_cop from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'USD' and i.number = 1), 141640::numeric, 'primera cuota USD en COP');
select is((select sum(principal_cop) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'USD'), 400000::numeric, 'capital COP exacto');
select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000002","type":"purchase","date":"2027-01-20","amount":"100","currency":"USD","fx_rate":"4000","amount_cop":"400000","installments_count":2,"interest_free":true,"rate_ea_applied":"0.28","category_id":null,"merchant":"","note":"","installments":[{"number":1,"cutoff_date":"2027-02-15","principal":"50","interest":"0","total":"50","balance_after":"50","principal_cop":"200000","interest_cop":"0","total_cop":"200000"},{"number":2,"cutoff_date":"2027-03-15","principal":"50","interest":"0","total":"50","balance_after":"0","principal_cop":"199999","interest_cop":"0","total_cop":"199999"}]}'::jsonb)
$sql$, '22023', null, 'rechaza capital COP incompleto');
select is((select count(*) from public.statements where cutoff_date >= '2027-01-01'), 0::bigint, 'el error de capital COP no crea extractos');
select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000002","type":"purchase","date":"2028-01-20","amount":"100","currency":"USD","fx_rate":"4000","amount_cop":"399999","installments_count":1,"interest_free":false,"rate_ea_applied":"0.28","category_id":null,"merchant":"","note":"","installments":[]}'::jsonb)
$sql$, '22023', null, 'rechaza TRM y monto COP inconsistentes');
select is((select count(*) from public.statements where cutoff_date >= '2028-01-01'), 0::bigint, 'error USD no crea extractos');

select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-15","amount":"100","currency":"COP","fx_rate":null,"amount_cop":"100","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"En corte","note":"","installments":[]}'::jsonb)
$sql$, 'guarda compra el día del corte');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id = t.statement_id where t.merchant = 'En corte'), '2026-01-15'::date, 'compra en corte pertenece al mismo corte');
select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-16","amount":"100","currency":"COP","fx_rate":null,"amount_cop":"100","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"Después del corte","note":"","installments":[]}'::jsonb)
$sql$, 'guarda compra posterior al corte');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id = t.statement_id where t.merchant = 'Después del corte'), '2026-02-15'::date, 'compra posterior pertenece al siguiente corte');
update public.cards set archived_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-20","amount":"100","currency":"COP","fx_rate":null,"amount_cop":"100","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"","note":"","installments":[]}'::jsonb)
$sql$, '42501', null, 'no se usa una tarjeta archivada');
update public.cards set archived_at = null where id = 'aaaaaaaa-0000-4000-8000-000000000001';

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-01-20","amount":"100","currency":"COP","fx_rate":null,"amount_cop":"100","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"","note":"","installments":[]}'::jsonb)
$sql$, '42501', null, 'otro usuario no puede usar la tarjeta');
reset role;
set local role anon;
select throws_ok($sql$ select public.create_transaction_with_installments('{}'::jsonb) $sql$, '42501', null, 'anon no puede ejecutar la RPC');
select * from finish();
rollback;
