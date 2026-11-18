begin;
select no_plan();
insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'interest-mode@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea, interest_mode)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2, 0.28, 'on_balance'),
       ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra', 'Banco', 'Visa', '5678', 10000000, 15, 2, 0.28, default);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}', true);
select is((select interest_mode::text from public.cards where name = 'Otra'), 'per_installment', 'el modo por defecto es por cuota');

select throws_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-10","amount":"200000","currency":"COP","fx_rate":null,"amount_cop":"200000","installments_count":2,"interest_free":false,"rate_ea_applied":"0.28","category_id":null,"merchant":"Con interés","note":"","installments":[{"number":1,"cutoff_date":"2026-11-15","principal":"100000","interest":"4157","total":"104157","balance_after":"100000","principal_cop":"100000","interest_cop":"4157","total_cop":"104157"},{"number":2,"cutoff_date":"2026-12-15","principal":"100000","interest":"2079","total":"102079","balance_after":"0","principal_cop":"100000","interest_cop":"2079","total_cop":"102079"}]}'::jsonb)
$sql$, '22023', 'Las cuotas de esta tarjeta son solo de capital', 'rechaza cuotas con interés en una tarjeta sobre saldo');
select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000001","type":"purchase","date":"2026-11-10","amount":"200000","currency":"COP","fx_rate":null,"amount_cop":"200000","installments_count":2,"interest_free":false,"rate_ea_applied":"0.28","category_id":null,"merchant":"Solo capital","note":"","installments":[{"number":1,"cutoff_date":"2026-11-15","principal":"100000","interest":"0","total":"100000","balance_after":"100000","principal_cop":"100000","interest_cop":"0","total_cop":"100000"},{"number":2,"cutoff_date":"2026-12-15","principal":"100000","interest":"0","total":"100000","balance_after":"0","principal_cop":"100000","interest_cop":"0","total_cop":"100000"}]}'::jsonb)
$sql$, 'acepta cuotas solo de capital y conserva la tasa');
select is((select rate_ea_applied from public.transactions where merchant = 'Solo capital'), 0.28::numeric, 'la tasa queda guardada para la estimación');
select lives_ok($sql$
  select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000002","type":"purchase","date":"2026-11-10","amount":"200000","currency":"COP","fx_rate":null,"amount_cop":"200000","installments_count":2,"interest_free":false,"rate_ea_applied":"0.28","category_id":null,"merchant":"Por cuota","note":"","installments":[{"number":1,"cutoff_date":"2026-11-15","principal":"100000","interest":"4157","total":"104157","balance_after":"100000","principal_cop":"100000","interest_cop":"4157","total_cop":"104157"},{"number":2,"cutoff_date":"2026-12-15","principal":"100000","interest":"2079","total":"102079","balance_after":"0","principal_cop":"100000","interest_cop":"2079","total_cop":"102079"}]}'::jsonb)
$sql$, 'una tarjeta por cuota sigue aceptando cuotas con interés');

select throws_ok($sql$ update public.cards set interest_mode = 'per_installment' where name = 'Visa' $sql$, '23514', 'No puedes cambiar el modo de intereses: la tarjeta ya tiene compras a cuotas.', 'el trigger bloquea el cambio con compras a cuotas');
select lives_ok($sql$ update public.cards set name = 'Visa Bancolombia' where name = 'Visa' $sql$, 'se pueden editar otros datos de la tarjeta');
delete from public.transactions where merchant in ('Solo capital', 'Por cuota');
select lives_ok($sql$ update public.cards set interest_mode = 'on_balance' where name = 'Otra' $sql$, 'sin compras a cuotas el modo se puede cambiar');
select * from finish();
rollback;
