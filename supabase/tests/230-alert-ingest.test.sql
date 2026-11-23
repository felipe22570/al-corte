begin;
select no_plan();

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230', 'ingest-a@example.com'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb230', 'ingest-b@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day) values
  ('aaaaaaaa-0000-4000-8000-000000000230', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230', 'Visa', 'Banco', 'Visa', '1999', 1000000, 15, 2),
  ('bbbbbbbb-0000-4000-8000-000000000230', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb230', 'Visa B', 'Banco', 'Visa', '7777', 1000000, 15, 2);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230","role":"authenticated"}', true);

-- Aliases (D44).
select lives_ok($$ insert into public.card_aliases (card_id, last4) values ('aaaaaaaa-0000-4000-8000-000000000230', '4321') $$, 'agrega un alias a su tarjeta');
select is((select user_id from public.card_aliases), 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230'::uuid, 'el alias es del dueño de la sesión');
select throws_ok($$ insert into public.card_aliases (card_id, last4) values ('aaaaaaaa-0000-4000-8000-000000000230', '4321') $$, '23505', null, 'unos mismos 4 dígitos no se repiten');
select throws_ok($$ insert into public.card_aliases (card_id, last4) values ('aaaaaaaa-0000-4000-8000-000000000230', '12a4') $$, '23514', null, 'solo 4 dígitos');
select throws_ok($$ insert into public.card_aliases (card_id, last4) values ('bbbbbbbb-0000-4000-8000-000000000230', '5555') $$, '42501', null, 'no agrega alias a la tarjeta de otro');
select throws_ok($$ update public.card_aliases set last4 = '9999' $$, '42501', null, 'un alias no se edita: se borra y se agrega');

-- Capture switch: off by default, owner only.
select lives_ok($$ insert into public.capture_settings default values $$, 'crea su ajuste de captura');
select is((select enabled from public.capture_settings), false, 'la captura empieza apagada');
select lives_ok($$ update public.capture_settings set enabled = true $$, 'la enciende');

-- The request counter is only for the ingest route.
select throws_ok($$ select public.ingest_rate_hit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230', 30) $$, '42501', null, 'la sesión no usa el contador');
select throws_ok($$ select count(*) from public.ingest_rate_limits $$, '42501', null, 'ni lo lee');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb230","role":"authenticated"}', true);
select is((select count(*) from public.card_aliases), 0::bigint, 'B no ve los alias de A');
select is((select count(*) from public.capture_settings), 0::bigint, 'ni su ajuste de captura');
with changed as (update public.capture_settings set enabled = false returning 1) select is((select count(*) from changed), 0::bigint, 'ni lo apaga');
with removed as (delete from public.card_aliases returning 1) select is((select count(*) from removed), 0::bigint, 'ni borra sus alias');

reset role;
set local role service_role;
select is((select array_agg(public.ingest_rate_hit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230', 2)) from generate_series(1, 3)), array[true, true, false], 'cuenta por minuto y rechaza sobre el límite');
select is(public.ingest_rate_hit('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb230', 2), true, 'cada dueño tiene su propio conteo');
select throws_ok($$ select public.ingest_rate_hit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230', 0) $$, '22023', null, 'el límite es positivo');
select lives_ok($$ insert into public.transaction_drafts (user_id, external_id, phrase, status) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230', 'msg-1', 'T.Cred *1999', 'needs_review') $$,
  'la llave de servicio crea borradores');
select is((select enabled from public.capture_settings where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa230'), true, 'y lee el ajuste de captura');

reset role;
select ok(not has_table_privilege('anon', 'public.card_aliases', 'select'), 'anon no lee alias');
select ok(not has_table_privilege('anon', 'public.capture_settings', 'select'), 'ni ajustes de captura');

select * from finish();
rollback;
