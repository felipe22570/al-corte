begin;
select no_plan();
insert into auth.users (id,email) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','subscriptions-a@example.com'),('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','subscriptions-b@example.com');
insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day)
values ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Visa','Banco','Visa','1234',1000000,15,5),
       ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','Visa','Banco','Visa','5678',1000000,15,5);
insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date,status,trial_ends_at)
values ('aaaaaaaa-0000-4000-8000-000000000011','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Mensual 31',30000,'COP','monthly',31,'2026-01-01','active',null),
       ('aaaaaaaa-0000-4000-8000-000000000012','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Anual 29',12000,'COP','yearly',29,'2027-02-28','active',null),
       ('aaaaaaaa-0000-4000-8000-000000000013','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Pausada',10000,'COP','monthly',29,'2026-01-01','paused',null),
       ('aaaaaaaa-0000-4000-8000-000000000014','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Prueba',10000,'COP','monthly',29,'2026-01-01','active','2028-03-01'),
       ('bbbbbbbb-0000-4000-8000-000000000011','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-0000-4000-8000-000000000001','Recuperación',20000,'COP','monthly',26,'2026-01-01','active',null);
select is(public.generate_subscription_charges('2028-02-29'),3,'cobra mensual, anual y recuperación');
select is(public.generate_subscription_charges('2028-02-29'),0,'ejecución repetida es idempotente');
select is((select count(*) from public.transactions where subscription_id='aaaaaaaa-0000-4000-8000-000000000011' and date='2028-02-29'),1::bigint,'día 31 se ajusta en febrero bisiesto');
select is((select count(*) from public.transactions where subscription_id='aaaaaaaa-0000-4000-8000-000000000012' and date='2028-02-29'),1::bigint,'renovación anual bisiesta');
select is((select count(*) from public.transactions where subscription_id='bbbbbbbb-0000-4000-8000-000000000011' and date='2028-02-26' and user_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),1::bigint,'recupera cobro con fecha y dueño originales');
select is((select count(*) from public.transactions where subscription_id in ('aaaaaaaa-0000-4000-8000-000000000013','aaaaaaaa-0000-4000-8000-000000000014')),0::bigint,'no cobra pausadas ni pruebas vigentes');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id=t.statement_id where t.subscription_id='bbbbbbbb-0000-4000-8000-000000000011'),'2028-03-15'::date,'el cobro recuperado va al extracto correcto');
select is((select count(*) from cron.job where jobname='generate-subscription-charges' and schedule='0 10 * * *'),1::bigint,'cron programado a las 10 UTC');
select is(public.generate_subscription_charges('2027-02-28'),3,'cobra febrero normal y recupera cobro pendiente');
select is((select count(*) from public.transactions where subscription_id='aaaaaaaa-0000-4000-8000-000000000011' and date='2027-02-28'),1::bigint,'día 31 se ajusta en febrero normal');
insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date,status)
values ('aaaaaaaa-0000-4000-8000-000000000015','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','USD',10,'USD','monthly',15,'2026-01-01','active');
delete from public.fx_rates;
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000015','2028-03-15'),0,'sin TRM no genera cobro');
insert into public.fx_rates (date,usd_cop) values ('2028-03-14',4000);
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000015','2028-03-15'),1,'con TRM genera cobro');
select is((select amount_cop from public.transactions where subscription_id='aaaaaaaa-0000-4000-8000-000000000015' and date='2028-03-15'),40000::numeric,'convierte USD a COP');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id=t.statement_id where t.subscription_id='aaaaaaaa-0000-4000-8000-000000000015' and t.date='2028-03-15'),'2028-03-15'::date,'cobro el día del corte pertenece al mismo corte');
update public.cards set archived_at=now() where id='aaaaaaaa-0000-4000-8000-000000000001';
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000015','2028-04-15'),0,'tarjeta archivada no genera cobros');
update public.cards set archived_at=null where id='aaaaaaaa-0000-4000-8000-000000000001';
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000012','2028-03-29'),0,'anual no cobra fuera del mes de inicio');
delete from public.fx_rates;
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000015','2028-04-15'),1,'usa TRM del último movimiento del mismo usuario');
select is((select fx_rate from public.transactions where subscription_id='aaaaaaaa-0000-4000-8000-000000000015' and date='2028-04-15'),4000::numeric,'TRM de respaldo guardada');
insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date,status)
values ('aaaaaaaa-0000-4000-8000-000000000016','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Después de corte',100,'COP','monthly',16,'2026-01-01','active');
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000016','2028-03-16'),1,'genera cobro después del corte');
select is((select s.cutoff_date from public.transactions t join public.statements s on s.id=t.statement_id where t.subscription_id='aaaaaaaa-0000-4000-8000-000000000016'),'2028-04-15'::date,'día posterior al corte usa siguiente extracto');
update public.subscriptions set status='cancelled' where id='aaaaaaaa-0000-4000-8000-000000000016';
select is(public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000016','2028-04-16'),0,'cancelada no genera cobros');
insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date,status)
select 'aaaaaaaa-0000-4000-8000-000000000017','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-0000-4000-8000-000000000001','Hoy',100,'COP','monthly',extract(day from (now() at time zone 'America/Bogota')::date)::integer,(now() at time zone 'America/Bogota')::date,'active';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","role":"authenticated"}',true);
select throws_ok($sql$select public.generate_subscription_charges('2028-02-29')$sql$,'42501',null,'usuario no ejecuta el cron global');
select throws_ok($sql$select public.generate_subscription_charge_on('aaaaaaaa-0000-4000-8000-000000000015','2028-03-15')$sql$,'42501',null,'usuario no ejecuta la función interna');
select throws_ok($sql$select public.generate_charges_for_subscription('bbbbbbbb-0000-4000-8000-000000000011')$sql$,'42501',null,'usuario no genera cobros para otro dueño');
select is(public.generate_charges_for_subscription('aaaaaaaa-0000-4000-8000-000000000017'),1,'dueño genera cobro de hoy');
select is(public.generate_charges_for_subscription('aaaaaaaa-0000-4000-8000-000000000017'),0,'generación inmediata es idempotente');
reset role;
select * from finish();
rollback;
