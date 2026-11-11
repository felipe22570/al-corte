begin;
select no_plan();
insert into auth.users (id, email) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-a@example.com'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-b@example.com');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}', true);
insert into public.cards (id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Visa', 'Banco', 'Visa', '1234', 1000, 15, 5);
insert into public.statements (id, card_id, period_start, cutoff_date, due_date)
values ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-01-16', '2026-02-15', '2026-03-05');
insert into public.subscriptions (id, card_id, name, amount, frequency, billing_day, start_date)
values ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Servicio', 100, 'monthly', 1, '2026-01-01');
insert into public.transactions (id, card_id, statement_id, type, date, amount, amount_cop)
values ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'purchase', '2026-02-01', 100, 100);
insert into public.installments (transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
values ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 1, 100, 0, 100, 0, 100, 0, 100);
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","role":"authenticated"}', true);
select is((select count(*) from public.cards), 0::bigint, 'B no ve tarjetas de A');
select is((select count(*) from public.statements), 0::bigint, 'B no ve extractos de A');
select is((select count(*) from public.transactions), 0::bigint, 'B no ve movimientos de A');
select is((select count(*) from public.installments), 0::bigint, 'B no ve cuotas de A');
select is((select count(*) from public.subscriptions), 0::bigint, 'B no ve suscripciones de A');
with changed as (update public.cards set name = 'Otro' returning 1) select is((select count(*) from changed), 0::bigint, 'B no modifica tarjetas de A');
with removed as (delete from public.cards returning 1) select is((select count(*) from removed), 0::bigint, 'B no borra tarjetas de A');
with changed as (update public.statements set real_total = 1 returning 1) select is((select count(*) from changed), 0::bigint, 'B no modifica extractos de A');
with changed as (update public.statements set paid_at = '2026-02-01T05:00:00Z' returning 1) select is((select count(*) from changed), 0::bigint, 'B no marca pagado el extracto de A');
with removed as (delete from public.statements returning 1) select is((select count(*) from removed), 0::bigint, 'B no borra extractos de A');
with changed as (update public.transactions set note = 'otro' returning 1) select is((select count(*) from changed), 0::bigint, 'B no modifica movimientos de A');
with removed as (delete from public.transactions returning 1) select is((select count(*) from removed), 0::bigint, 'B no borra movimientos de A');
with changed as (update public.installments set balance_after = 0 returning 1) select is((select count(*) from changed), 0::bigint, 'B no modifica cuotas de A');
with removed as (delete from public.installments returning 1) select is((select count(*) from removed), 0::bigint, 'B no borra cuotas de A');
with changed as (update public.subscriptions set name = 'Otro' returning 1) select is((select count(*) from changed), 0::bigint, 'B no modifica suscripciones de A');
with removed as (delete from public.subscriptions returning 1) select is((select count(*) from removed), 0::bigint, 'B no borra suscripciones de A');
select throws_ok($$insert into public.cards (user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Visa', 'Banco', 'Visa', '1234', 1000, 15, 5)$$, '42501', null, 'B no inserta tarjetas de A');
select throws_ok($$insert into public.statements (user_id, card_id, period_start, cutoff_date, due_date) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000001', '2026-02-16', '2026-03-15', '2026-04-05')$$, '42501', null, 'B no inserta extractos de A');
select throws_ok($$insert into public.subscriptions (user_id, card_id, name, amount, frequency, billing_day, start_date) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000001', 'Otra', 100, 'monthly', 1, '2026-01-01')$$, '42501', null, 'B no inserta suscripciones de A');
select throws_ok($$insert into public.transactions (user_id, card_id, statement_id, type, date, amount, amount_cop) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000002', 'purchase', '2026-02-02', 100, 100)$$, '42501', null, 'B no inserta movimientos de A');
select throws_ok($$insert into public.installments (user_id, transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 2, 100, 0, 100, 0, 100, 0, 100)$$, '42501', null, 'B no inserta cuotas de A');
select throws_ok($$insert into public.statements (card_id, period_start, cutoff_date, due_date) values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-02-16', '2026-03-15', '2026-04-05')$$, '23503', null, 'B no referencia tarjetas de A');
reset role;
set local role anon;
select throws_ok('select * from public.cards', '42501', null, 'anon no lee tarjetas');
select * from finish();
rollback;
