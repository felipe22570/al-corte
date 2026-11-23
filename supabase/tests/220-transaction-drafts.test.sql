begin;
select no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'drafts-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb220', 'drafts-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('aaaaaaaa-0000-4000-8000-000000000220', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'Visa', 'Banco', 'Visa', '1999', 5000000, 15, 2);
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('bbbbbbbb-0000-4000-8000-000000000220', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb220', 'Visa B', 'Banco', 'Visa', '1999', 5000000, 15, 2);

-- Drafts are created by the ingest route with the service key (step 42); here the test inserts them as postgres.
insert into public.transaction_drafts (id, user_id, external_id, phrase, card_id, last4, type, amount, currency, merchant_raw, occurred_on, occurred_time, statement_cutoff, suggestions, status) values
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-1', 'Compraste COP140.910,00 en DIRECTV', 'aaaaaaaa-0000-4000-8000-000000000220', '1999', 'purchase', 140910, 'COP', 'DIRECTV', '2026-11-17', '12:27', '2026-12-15', '{"confidence":"alta"}', 'pending'),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-2', 'Compraste COP81.000,00 en GOOGLE *ChatGPT', 'aaaaaaaa-0000-4000-8000-000000000220', '1999', 'purchase', 81000, 'COP', 'GOOGLE *ChatGPT', '2026-11-16', '11:33', '2026-11-15', null, 'pending'),
  ('dddddddd-0000-4000-8000-000000000003', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-3', 'Compraste COP20.000,00 en TIENDA', null, '0000', 'purchase', 20000, 'COP', 'TIENDA', '2026-11-18', '09:00', null, null, 'unknown_card');

select throws_ok($$ insert into public.transaction_drafts (user_id, external_id, phrase, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-1', 'otra vez', 'needs_review') $$,
  '23505', null, 'el mismo mensaje nunca crea dos borradores');
select throws_ok($$ insert into public.transaction_drafts (user_id, external_id, phrase, card_id, type, amount, currency, occurred_on) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-x', 'x', 'bbbbbbbb-0000-4000-8000-000000000220', 'purchase', 1, 'COP', '2026-11-18') $$,
  '42501', null, 'la tarjeta es del dueño del borrador');
select throws_ok($$ insert into public.transaction_drafts (user_id, external_id, phrase, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-y', 'x', 'pending') $$,
  '23514', null, 'un borrador pendiente tiene tarjeta, tipo, valor, moneda y fecha');
select throws_ok($$ insert into public.transaction_drafts (user_id, external_id, phrase, status, resolved_at) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-z', 'x', 'discarded', now()) $$,
  '23514', null, 'un borrador resuelto no guarda la frase');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220","role":"authenticated"}', true);

-- A pending draft does not reach any total (D46).
select is((select count(*) from public.statements), 0::bigint, 'los borradores no crean extractos');
select is((select count(*) from public.statement_currency_totals), 0::bigint, 'ni totales por moneda');
select results_eq($$ select used, available from public.card_balances where card_id = 'aaaaaaaa-0000-4000-8000-000000000220' $$, $$ values (0::numeric, 5000000::numeric) $$, 'ni consumen cupo');
select ok(not exists (select 1 from pg_views where schemaname = 'public' and definition ilike '%transaction_drafts%'), 'ninguna vista lee los borradores');

select throws_ok($$ insert into public.transaction_drafts (external_id, phrase, status) values ('msg-4', 'x', 'needs_review') $$, '42501', null, 'la sesión no crea borradores');
select throws_ok($$ delete from public.transaction_drafts $$, '42501', null, 'ni los borra');

-- Confirm: exactly one movement, captured by email, and the draft keeps only identifier, state and link (D47).
select lives_ok($sql$
  select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000001', '{"card_id":"aaaaaaaa-0000-4000-8000-000000000220","type":"purchase","date":"2026-11-17","amount":"140910","currency":"COP","fx_rate":null,"amount_cop":"140910","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"DirecTV","note":"","installments":[]}'::jsonb)
$sql$, 'confirma el borrador');
select is((select count(*) from public.transactions), 1::bigint, 'crea exactamente un movimiento');
select is((select source::text from public.transactions), 'email', 'con origen correo');
select results_eq($$ select status, transaction_id = (select id from public.transactions), phrase, suggestions, amount, merchant_raw, card_id, resolved_at is not null from public.transaction_drafts where external_id = 'msg-1' $$,
  $$ values ('confirmed', true, null::text, null::jsonb, null::numeric, null::text, null::uuid, true) $$, 'vacía la frase y los datos del correo');
select results_eq($$ select currency::text, total_calculated from public.statement_currency_totals where card_id = 'aaaaaaaa-0000-4000-8000-000000000220' $$,
  $$ values ('COP', 140910::numeric) $$, 'solo el movimiento confirmado entra al extracto');
select results_eq($$ select used, available from public.card_balances where card_id = 'aaaaaaaa-0000-4000-8000-000000000220' $$, $$ values (140910::numeric, 4859090::numeric) $$, 'y al cupo');
select throws_ok($$ select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000001', '{}'::jsonb) $$, 'P0002', null, 'no se confirma dos veces');
select is((select count(*) from public.transactions), 1::bigint, 'sin movimientos repetidos');
select throws_ok($$ update public.transaction_drafts set status = 'pending', resolved_at = null where external_id = 'msg-1' $$, '22023', null, 'un borrador resuelto no se reabre');

-- A confirmation that the RPC rejects leaves the draft open.
select throws_ok($sql$
  select public.confirm_transaction_draft('dddddddd-0000-4000-8000-000000000002', '{"card_id":"aaaaaaaa-0000-4000-8000-000000000220","type":"purchase","date":"2026-11-16","amount":"-1","currency":"COP","amount_cop":"-1","installments_count":1,"interest_free":false,"rate_ea_applied":"0","installments":[]}'::jsonb)
$sql$, '22023', null, 'un movimiento inválido no confirma');
select is((select status from public.transaction_drafts where external_id = 'msg-2'), 'pending', 'y el borrador sigue abierto');

-- "Es el mismo": only with a movement of the same card, amount, currency and date, and only once.
select public.create_transaction_with_installments('{"card_id":"aaaaaaaa-0000-4000-8000-000000000220","type":"purchase","date":"2026-11-16","amount":"81000","currency":"COP","fx_rate":null,"amount_cop":"81000","installments_count":1,"interest_free":false,"rate_ea_applied":"0","category_id":null,"merchant":"ChatGPT","note":"","installments":[]}'::jsonb);
select throws_ok($$ select public.link_transaction_draft('dddddddd-0000-4000-8000-000000000002', (select id from public.transactions where merchant = 'DirecTV')) $$,
  '22023', null, 'no enlaza un movimiento distinto');
select lives_ok($$ select public.link_transaction_draft('dddddddd-0000-4000-8000-000000000002', (select id from public.transactions where merchant = 'ChatGPT')) $$, 'enlaza el movimiento igual');
select is((select count(*) from public.transactions), 2::bigint, 'sin crear otro movimiento');
select results_eq($$ select source::text, merchant from public.transactions where id = (select transaction_id from public.transaction_drafts where external_id = 'msg-2') $$,
  $$ values ('manual', 'ChatGPT') $$, 'sin cambiar el movimiento enlazado');

-- Discard keeps only the identifier, so the same message is not captured again.
select lives_ok($$ select public.discard_transaction_draft('dddddddd-0000-4000-8000-000000000003') $$, 'descarta el borrador');
select results_eq($$ select status, phrase, amount, last4, transaction_id from public.transaction_drafts where external_id = 'msg-3' $$,
  $$ values ('discarded', null::text, null::numeric, null::text, null::uuid) $$, 'conserva solo el identificador');
select throws_ok($$ select public.discard_transaction_draft('dddddddd-0000-4000-8000-000000000003') $$, 'P0002', null, 'un descartado no se recupera');

-- Deleting the confirmed movement keeps the resolved draft.
delete from public.transactions where merchant = 'DirecTV';
select results_eq($$ select status, transaction_id from public.transaction_drafts where external_id = 'msg-1' $$, $$ values ('confirmed', null::uuid) $$, 'borrar el movimiento conserva el borrador resuelto');

-- Another owner sees and resolves nothing.
reset role;
insert into public.transaction_drafts (id, user_id, external_id, phrase, card_id, last4, type, amount, currency, merchant_raw, occurred_on, status) values
  ('dddddddd-0000-4000-8000-000000000004', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa220', 'msg-4', 'Compraste', 'aaaaaaaa-0000-4000-8000-000000000220', '1999', 'purchase', 5000, 'COP', 'CAFE', '2026-11-18', 'pending');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb220","role":"authenticated"}', true);
select is((select count(*) from public.transaction_drafts), 0::bigint, 'B no ve los borradores de A');
select throws_ok($$ select public.discard_transaction_draft('dddddddd-0000-4000-8000-000000000004') $$, 'P0002', null, 'ni los descarta');
with changed as (update public.transaction_drafts set phrase = 'otra' returning 1) select is((select count(*) from changed), 0::bigint, 'ni los modifica');
reset role;
select is((select status from public.transaction_drafts where external_id = 'msg-4'), 'pending', 'el borrador de A sigue abierto');
select ok(not has_table_privilege('anon', 'public.transaction_drafts', 'select'), 'anon no lee borradores');

select * from finish();
rollback;
