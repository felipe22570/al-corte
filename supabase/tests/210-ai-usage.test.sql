begin;
select no_plan();

insert into auth.users (id, email) values
 ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa210', 'ai-a@example.com'),
 ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb210', 'ai-b@example.com');

select ok((select relrowsecurity from pg_class where oid = 'public.ai_usage'::regclass), 'ai_usage tiene RLS activado');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa210","role":"authenticated"}', true);
insert into public.ai_usage (task, prompt_version, model, input_tokens, output_tokens, cost_usd, latency_ms, result, created_at) values
  ('smokeCheck', 'v1', 'claude-opus-5-5', 300, 40, 0.002000, 900, 'ok', '2026-11-01T05:00:00Z'),
  ('smokeCheck', 'v1', 'claude-opus-5-5', 300, 50, 0.002200, 950, 'invalid_output', '2026-11-20T15:00:00Z'),
  ('smokeCheck', 'v1', 'claude-opus-5-5', 0, 0, 0, 0, 'budget_exceeded', '2026-11-21T15:00:00Z'),
  ('smokeCheck', 'v1', 'claude-opus-5-5', 300, 40, 0.002000, 900, 'ok', '2026-10-31T23:00:00Z');
select is((select user_id from public.ai_usage limit 1), 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa210'::uuid, 'user_id sale de la sesión');
select is(public.ai_usage_spent_since('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa210', '2026-11-01T05:00:00Z'), '0.004200',
  'suma el gasto desde el inicio del mes en Bogotá con decimales exactos');

select throws_ok($$ update public.ai_usage set cost_usd = 0 $$, '42501', null, 'el dueño no edita su registro');
select throws_ok($$ delete from public.ai_usage $$, '42501', null, 'ni lo borra');
select throws_ok($$ insert into public.ai_usage (task, prompt_version, model, result) values ('smokeCheck', 'v1', 'claude-opus-5-5', 'otro') $$,
  '23514', null, 'el resultado es uno de los conocidos');
select throws_ok($$ insert into public.ai_usage (task, prompt_version, model, cost_usd, result) values ('smokeCheck', 'v1', 'claude-opus-5-5', -1, 'ok') $$,
  '23514', null, 'el costo no es negativo');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbb210","role":"authenticated"}', true);
select is((select count(*) from public.ai_usage), 0::bigint, 'B no ve el registro de A');
select is(public.ai_usage_spent_since('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa210', '2026-01-01T05:00:00Z'), '0', 'ni su gasto');
select throws_ok($$ insert into public.ai_usage (user_id, task, prompt_version, model, result) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaa210', 'smokeCheck', 'v1', 'claude-opus-5-5', 'ok') $$,
  '42501', null, 'B no escribe en el registro de A');

reset role;
select ok(not has_table_privilege('anon', 'public.ai_usage', 'select'), 'anon no lee el registro');
select ok(not has_function_privilege('anon', 'public.ai_usage_spent_since(uuid, timestamptz)', 'execute'), 'ni consulta el gasto');

select * from finish();
rollback;
