begin;
select no_plan();

insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240', 'drafts-changes@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('aaaaaaaa-0000-4000-8000-000000000240', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240', 'Visa', 'Banco', 'Visa', '1999', 5000000, 15, 2);
insert into public.transaction_drafts (id, user_id, external_id, phrase, card_id, last4, type, amount, currency, merchant_raw, occurred_on, status) values
  ('dddddddd-0000-4000-8000-000000000241', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240', 'msg-241', 'Compraste COP1.000,00 en A', 'aaaaaaaa-0000-4000-8000-000000000240', '1999', 'purchase', 1000, 'COP', 'A', '2026-11-17', 'pending'),
  ('dddddddd-0000-4000-8000-000000000242', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240', 'msg-242', 'Compraste COP2.000,00 en B', 'aaaaaaaa-0000-4000-8000-000000000240', '1999', 'purchase', 2000, 'COP', 'B', '2026-11-17', 'pending'),
  ('dddddddd-0000-4000-8000-000000000243', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240', 'msg-243', 'Compraste COP3.000,00 en C', 'aaaaaaaa-0000-4000-8000-000000000240', '1999', 'purchase', 3000, 'COP', 'C', '2026-11-17', 'pending'),
  ('dddddddd-0000-4000-8000-000000000244', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240', 'msg-244', 'Compraste COP4.000,00 en D', 'aaaaaaaa-0000-4000-8000-000000000240', '1999', 'purchase', 4000, 'COP', 'D', '2026-11-17', 'pending');

select throws_ok($$ update public.transaction_drafts set changed_fields = '{}' where external_id = 'msg-244' $$, '23514', null, 'un borrador abierto no tiene cambios registrados');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa240","role":"authenticated"}', true);

create temporary table payload_template as select '{"card_id":"aaaaaaaa-0000-4000-8000-000000000240","type":"purchase","date":"2026-11-17","currency":"COP","fx_rate":null,"installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"note":"","installments":[]}'::jsonb as value;

select lives_ok($$ select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000241', (select value || '{"amount":"1000","amount_cop":"1000","merchant":"A"}' from payload_template), '{}') $$, 'confirma sin cambios');
select lives_ok($$ select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000242', (select value || '{"amount":"2500","amount_cop":"2500","merchant":"Otro"}' from payload_template), array['merchant', 'amount', 'amount']) $$, 'confirma con correcciones');
select lives_ok($$ select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000243', (select value || '{"amount":"3000","amount_cop":"3000","merchant":"C"}' from payload_template)) $$, 'la llamada anterior, sin la lista, sigue funcionando');

select results_eq($$ select external_id, changed_fields from public.transaction_drafts where external_id in ('msg-241', 'msg-242', 'msg-243') order by external_id $$,
  $$ values ('msg-241', '{}'::text[]), ('msg-242', '{amount,merchant}'::text[]), ('msg-243', null::text[]) $$,
  'guarda solo los nombres de los campos, sin repetir; sin lista queda desconocido');
select results_eq($$ select phrase, amount, merchant_raw from public.transaction_drafts where external_id = 'msg-242' $$,
  $$ values (null::text, null::numeric, null::text) $$, 'y sigue sin guardar datos del correo (D47)');

select throws_ok($$ select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000244', (select value || '{"amount":"4000","amount_cop":"4000","merchant":"D"}' from payload_template), array['phrase']) $$,
  '23514', null, 'no acepta nombres fuera de la lista');
select is((select status from public.transaction_drafts where external_id = 'msg-244'), 'pending', 'y el borrador sigue abierto, sin movimiento');
select is((select count(*) from public.transactions where merchant = 'D'), 0::bigint, 'sin crear el movimiento');

select * from finish();
rollback;
