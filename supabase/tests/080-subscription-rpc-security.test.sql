begin;
select no_plan();

select ok(not prosecdef, 'la RPC pública usa SECURITY INVOKER')
from pg_proc where oid = 'public.generate_charges_for_subscription(uuid)'::regprocedure;
select has_function('private', 'generate_charges_for_subscription', array['uuid'], 'la implementación privilegiada vive en private');
select ok(exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private' and p.proname = 'generate_charges_for_subscription'
    and p.prosecdef and p.proconfig @> array['search_path=""']
), 'la implementación privada conserva SECURITY DEFINER y search_path vacío');
select ok(exists (
  select 1 from pg_namespace where nspname = 'private'
    and has_schema_privilege('authenticated', oid, 'USAGE')
    and not has_schema_privilege('authenticated', oid, 'CREATE')
    and not has_schema_privilege('anon', oid, 'USAGE')
), 'private no admite usuarios anónimos ni creación de objetos por authenticated');
select is((
  select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and has_function_privilege('authenticated', p.oid, 'EXECUTE')
), 0::bigint, 'ninguna función SECURITY DEFINER pública es ejecutable por authenticated');

insert into auth.users (id,email) values
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','rpc-security-a@example.com'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd','rpc-security-b@example.com');
insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day) values
  ('cccccccc-0000-4000-8000-000000000001','cccccccc-cccc-4ccc-8ccc-cccccccccccc','Visa A','Pruebas','Visa','1234',1000000,15,2),
  ('dddddddd-0000-4000-8000-000000000001','dddddddd-dddd-4ddd-8ddd-dddddddddddd','Visa B','Pruebas','Visa','5678',1000000,15,2);
insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date) values
  ('cccccccc-0000-4000-8000-000000000011','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-0000-4000-8000-000000000001','Hoy A',100,'COP','monthly',extract(day from (now() at time zone 'America/Bogota'))::integer,(now() at time zone 'America/Bogota')::date),
  ('dddddddd-0000-4000-8000-000000000011','dddddddd-dddd-4ddd-8ddd-dddddddddddd','dddddddd-0000-4000-8000-000000000001','Hoy B',200,'COP','monthly',extract(day from (now() at time zone 'America/Bogota'))::integer,(now() at time zone 'America/Bogota')::date);

set local role anon;
select throws_ok($sql$select public.generate_charges_for_subscription('cccccccc-0000-4000-8000-000000000011')$sql$, '42501', null, 'anónimo no ejecuta la RPC pública');
select throws_ok($sql$select private.generate_charges_for_subscription('cccccccc-0000-4000-8000-000000000011')$sql$, '42501', null, 'anónimo no ejecuta la implementación privada');
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"cccccccc-cccc-4ccc-8ccc-cccccccccccc","role":"authenticated"}',true);
select throws_ok($sql$select public.generate_charges_for_subscription('dddddddd-0000-4000-8000-000000000011')$sql$, '42501', null, 'la RPC pública rechaza suscripciones ajenas');
select throws_ok($sql$select private.generate_charges_for_subscription('dddddddd-0000-4000-8000-000000000011')$sql$, '42501', null, 'la implementación privada también valida el dueño');
select throws_ok($sql$select public.generate_charges_for_subscription(null)$sql$, '42501', null, 'la RPC rechaza una suscripción nula');
select is(public.generate_charges_for_subscription('cccccccc-0000-4000-8000-000000000011'), 1, 'el dueño genera su cobro por la misma RPC');
select is(public.generate_charges_for_subscription('cccccccc-0000-4000-8000-000000000011'), 0, 'la RPC sigue siendo idempotente');
select throws_ok($sql$select public.generate_subscription_charge_on('cccccccc-0000-4000-8000-000000000011',current_date)$sql$, '42501', null, 'authenticated no obtiene acceso al generador interno');
select throws_ok($sql$select public.generate_subscription_charges()$sql$, '42501', null, 'authenticated no obtiene acceso al cron global');
reset role;

select is((select count(*) from public.transactions where subscription_id='cccccccc-0000-4000-8000-000000000011'), 1::bigint, 'solo existe un cobro propio');
select is((select count(*) from public.transactions where subscription_id='dddddddd-0000-4000-8000-000000000011'), 0::bigint, 'no se generaron cobros del otro dueño');
select * from finish();
rollback;
