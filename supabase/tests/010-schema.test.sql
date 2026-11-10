begin;
select no_plan();

select has_table('public', 'cards', 'existe cards');
select has_table('public', 'categories', 'existe categories');
select has_table('public', 'statements', 'existe statements');
select has_table('public', 'transactions', 'existe transactions');
select has_table('public', 'installments', 'existe installments');
select has_table('public', 'subscriptions', 'existe subscriptions');
select has_table('public', 'fx_rates', 'existe fx_rates');
select has_table('public', 'notification_log', 'existe notification_log');
select col_type_is('public', 'transactions', 'amount', 'numeric(14,2)', 'monto de movimiento');
select col_type_is('public', 'transactions', 'date', 'date', 'fecha de movimiento');
select col_type_is('public', 'installments', 'principal_cop', 'numeric(14,2)', 'capital COP de cuota');
select col_type_is('public', 'statements', 'cutoff_date', 'date', 'fecha de corte');
select ok((select bool_and(relrowsecurity) from pg_class where oid in (
  'public.cards'::regclass, 'public.categories'::regclass, 'public.statements'::regclass,
  'public.transactions'::regclass, 'public.installments'::regclass, 'public.subscriptions'::regclass,
  'public.fx_rates'::regclass, 'public.notification_log'::regclass
)), 'RLS está activo en todas las tablas');

insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111', 'schema-test@example.com');
select is((select count(*) from public.categories where user_id = '11111111-1111-1111-1111-111111111111'), 11::bigint, 'se crean once categorías');
select is((select count(*) from public.categories where user_id = '11111111-1111-1111-1111-111111111111' and icon is not null), 11::bigint, 'todas las categorías tienen icono');
select public.create_default_categories('11111111-1111-1111-1111-111111111111');
select is((select count(*) from public.categories where user_id = '11111111-1111-1111-1111-111111111111'), 11::bigint, 'la inicialización es idempotente');

insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day)
values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Visa', 'Banco', 'Visa', '1234', 1000000, 15, 5);
select throws_ok($$update public.cards set cutoff_day = 0$$, '23514', null, 'rechaza corte 0');
select throws_ok($$update public.cards set payment_day = 32$$, '23514', null, 'rechaza pago 32');
select throws_ok($$update public.cards set color = '#ff0000'$$, '23514', null, 'rechaza colores hex');
select throws_ok($$update public.cards set color = 'card-7'$$, '23514', null, 'rechaza colores fuera del tema');

insert into public.statements (id, user_id, card_id, period_start, cutoff_date, due_date)
values ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '2026-01-16', '2026-02-15', '2026-03-05');
select throws_ok($$insert into public.statements (user_id, card_id, period_start, cutoff_date, due_date) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '2026-01-16', '2026-02-15', '2026-03-05')$$, '23505', null, 'un extracto por corte y tarjeta');
insert into public.subscriptions (id, user_id, card_id, name, amount, frequency, billing_day, start_date)
values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Servicio', 10000, 'monthly', 1, '2026-01-01');
insert into public.transactions (user_id, card_id, statement_id, type, date, amount, amount_cop, subscription_id)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'purchase', '2026-02-01', 10000, 10000, '44444444-4444-4444-4444-444444444444');
select throws_ok($$insert into public.transactions (user_id, card_id, statement_id, type, date, amount, amount_cop, subscription_id) values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', 'purchase', '2026-02-01', 10000, 10000, '44444444-4444-4444-4444-444444444444')$$, '23505', null, 'no se duplica un cobro');
select throws_ok($$update public.transactions set installments_count = 37$$, '23514', null, 'máximo 36 cuotas');

select * from finish();
rollback;
