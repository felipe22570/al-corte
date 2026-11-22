begin;
select no_plan();
insert into auth.users (id, email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'deferred@example.com');
insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day, purchase_rate_ea, interest_mode, usd_default_installments)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Visa', 'Bancolombia', 'Visa', '1234', 10000000, 15, 2, 0.2899, 'on_balance', 36),
       ('aaaaaaaa-0000-4000-8000-000000000002', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Otra', 'Banco', 'Visa', '5678', 10000000, 15, 2, 0.2899, 'per_installment', 1);
-- The daily TRM job (D57) may have loaded real rates: the test sets its own, rolled back at the end.
delete from public.fx_rates;
insert into public.fx_rates (date, usd_cop) values ('2026-11-01', 4000);
insert into public.subscriptions (id, user_id, card_id, name, amount, currency, frequency, billing_day, start_date, status, installments_count) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', 'ChatGPT', 12.99, 'USD', 'monthly', 20, '2026-01-01', 'active', 36),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000002', 'Por cuota', 300000, 'COP', 'monthly', 20, '2026-01-01', 'active', 3),
  ('aaaaaaaa-0000-4000-8000-000000000013', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000002', 'Una cuota', 25000, 'COP', 'monthly', 20, '2026-01-01', 'active', 1);

select is(public.generate_subscription_charges('2026-11-20'), 3, 'genera los tres cobros del día');
select is(public.generate_subscription_charges('2026-11-20'), 0, 'repetir el cron no duplica cobros');
select results_eq($$ select installments_count, rate_ea_applied, amount_cop from public.transactions where merchant = 'ChatGPT' $$,
  $$ values (36::smallint, 0.2899::numeric, 51960::numeric) $$, 'el cobro USD queda como compra a 36 cuotas con la tasa de la tarjeta');
select is((select count(*) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'ChatGPT'), 36::bigint, 'treinta y seis cuotas');
select is((select sum(i.interest) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'ChatGPT'), 0::numeric, 'sobre saldo: cuotas solo de capital');
select is((select sum(i.principal) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'ChatGPT'), 12.99::numeric, 'el capital suma el cobro');
select is((select sum(i.principal_cop) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'ChatGPT'), 51960::numeric, 'el equivalente COP suma el del cobro');
select is((select s.cutoff_date from public.installments i join public.transactions t on t.id = i.transaction_id join public.statements s on s.id = i.statement_id where t.merchant = 'ChatGPT' and i.number = 1), '2026-12-15'::date, 'la primera cuota cae en el extracto del cobro');
select is((select s.cutoff_date from public.installments i join public.transactions t on t.id = i.transaction_id join public.statements s on s.id = i.statement_id where t.merchant = 'ChatGPT' and i.number = 36), '2029-11-15'::date, 'la última cuota cae 35 meses después');
select is((select sum(i.interest) > 0 from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'Por cuota'), true, 'por cuota: el interés va dentro de las cuotas');
select results_eq($$ select installments_count, rate_ea_applied from public.transactions where merchant = 'Una cuota' $$, $$ values (1::smallint, null::numeric) $$, 'una cuota se comporta igual que antes');
select is((select count(*) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'Una cuota'), 0::bigint, 'una cuota no crea filas de cuotas');

select throws_ok($$ insert into public.subscriptions (user_id, card_id, name, amount, currency, frequency, billing_day, start_date, installments_count) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000002', 'Mínima', 0.17, 'USD', 'monthly', 1, '2026-01-01', 36) $$,
  '23514', null, 'rechaza una suscripción con la cuota redondeada a cero');
-- R2 with the bank's rounding: US$ 2,79 a 36 cuotas termina en 35 (34 de US$ 0,08 y la última de US$ 0,07).
insert into public.subscriptions (id, user_id, card_id, name, amount, currency, frequency, billing_day, start_date, status, installments_count) values
  ('aaaaaaaa-0000-4000-8000-000000000014', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-4000-8000-000000000001', 'Pequeña', 2.79, 'USD', 'monthly', 21, '2026-01-01', 'active', 36);
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000014', '2026-11-21'), 1, 'cobra una suscripción con cuota mínima');
select results_eq($$ select installments_count, original_installments_count from public.transactions where merchant = 'Pequeña' $$, $$ values (35::smallint, 36::smallint) $$,
  'el plan efectivo es más corto y conserva el N original');
select results_eq($$ select count(*), sum(i.principal), max(i.principal) filter (where i.number = 35) from public.installments i join public.transactions t on t.id = i.transaction_id where t.merchant = 'Pequeña' $$,
  $$ values (35::bigint, 2.79::numeric, 0.07::numeric) $$, 'la última cuota lleva el resto');
select throws_ok($$ update public.cards set usd_default_installments = 37 $$, '23514', null, 'cuotas en USD por defecto entre 1 y 36');
select is((select usd_default_installments from public.cards where name = 'Otra'), 1::smallint, 'por defecto una cuota');
select * from finish();
rollback;
