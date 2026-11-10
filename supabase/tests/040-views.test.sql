begin;
select no_plan();
insert into auth.users (id, email) values
 ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'views-a@example.com'),
 ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'views-b@example.com');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-dddd-dddd-dddd-dddddddddddd","role":"authenticated"}', true);
insert into public.cards (id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('dddddddd-0000-0000-0000-000000000001', 'Visa', 'Banco', 'Visa', '1234', 5000000, 15, 5);
insert into public.statements (id, card_id, period_start, cutoff_date, due_date)
values ('dddddddd-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', '2026-01-16', '2026-02-15', '2026-03-05');
insert into public.transactions (id, card_id, statement_id, type, date, amount, currency, fx_rate, amount_cop, installments_count)
values ('dddddddd-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'purchase', '2026-02-01', 100, 'USD', 4000, 400000, 3);
insert into public.installments (transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
values ('dddddddd-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000002', 1, 33.33, 2.08, 35.41, 66.67, 133320, 8320, 141640);
select is((select installments from public.statement_totals), 141640::numeric, 'cuota en COP, no USD');
select is((select total_calculated from public.statement_totals), 141640::numeric, 'no se duplica el movimiento padre');
select is((select used from public.card_balances), 408320::numeric, 'cupo incluye interés facturado');
select is((select available from public.card_balances), 4591680::numeric, 'cupo disponible');
insert into public.transactions (card_id, statement_id, type, date, amount, amount_cop, source)
values
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'purchase', '2026-02-02', 100, 100, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'purchase', '2026-02-03', 20, 20, 'subscription'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'cash_advance', '2026-02-03', 30, 30, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'advance_fee', '2026-02-03', 5, 5, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'handling_fee', '2026-02-03', 10, 10, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'insurance', '2026-02-03', 7, 7, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'interest', '2026-02-03', 3, 3, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'adjustment', '2026-02-03', 4, 4, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'refund', '2026-02-03', 6, 6, 'manual'),
 ('dddddddd-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000002', 'payment', '2026-02-03', 40, 40, 'manual');
select is((select total_calculated from public.statement_totals), 141813::numeric, 'total por conceptos con ajustes y devolución');
select is((select payments from public.statement_totals), 40::numeric, 'pagos separados del total');
select is((select subscriptions from public.statement_totals), 20::numeric, 'suscripciones separadas');
select is((select cash_advances from public.statement_totals), 35::numeric, 'avance y comisión');
insert into public.cards (id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('dddddddd-0000-0000-0000-000000000005', 'Visa 2', 'Banco', 'Visa', '5678', 5000000, 15, 5);
insert into public.statements (id, card_id, period_start, cutoff_date, due_date)
values ('dddddddd-0000-0000-0000-000000000006', 'dddddddd-0000-0000-0000-000000000005', '2026-01-16', '2026-02-15', '2026-03-05');
insert into public.transactions (id, card_id, statement_id, type, date, amount, amount_cop, installments_count)
values ('dddddddd-0000-0000-0000-000000000007', 'dddddddd-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000006', 'purchase', '2026-02-01', 1500000, 1500000, 2);
insert into public.transactions (card_id, statement_id, type, date, amount, amount_cop)
values ('dddddddd-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000006', 'payment', '2026-02-02', 500000, 500000),
       ('dddddddd-0000-0000-0000-000000000005', 'dddddddd-0000-0000-0000-000000000006', 'refund', '2026-02-03', 20000, 20000);
insert into public.installments (transaction_id, statement_id, number, principal, interest, total, balance_after, principal_cop, interest_cop, total_cop)
values ('dddddddd-0000-0000-0000-000000000007', 'dddddddd-0000-0000-0000-000000000006', 1, 750000, 20000, 770000, 750000, 750000, 20000, 770000);
select is((select used from public.card_balances where card_id = 'dddddddd-0000-0000-0000-000000000005'), 1000000::numeric, 'cupo usado según D2');
select is((select available from public.card_balances where card_id = 'dddddddd-0000-0000-0000-000000000005'), 4000000::numeric, 'cupo disponible según D2');
select is((select utilization from public.card_balances where card_id = 'dddddddd-0000-0000-0000-000000000005'), 0.2::numeric, 'utilización según D2');
select set_config('request.jwt.claims', '{"sub":"eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee","role":"authenticated"}', true);
select is((select count(*) from public.statement_totals), 0::bigint, 'vistas no exponen extractos de otro usuario');
select is((select count(*) from public.card_balances), 0::bigint, 'vistas no exponen tarjetas de otro usuario');
select * from finish();
rollback;
