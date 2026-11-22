begin;
select no_plan();

-- Official periods as datos.gov.co returns them: one day, then a weekend with a holiday (D57).
select set_config('test.rows', '[
  {"valor":"3301.91","unidad":"COP","vigenciadesde":"2099-11-13T00:00:00.000","vigenciahasta":"2099-11-13T00:00:00.000"},
  {"valor":"3316.7","unidad":"COP","vigenciadesde":"2099-11-14T00:00:00.000","vigenciahasta":"2099-11-17T00:00:00.000"}
]', true);

select is(private.upsert_fx_rates(current_setting('test.rows')::jsonb, '2099-11-16'), 4, 'guarda un día por fecha calendario hasta el límite');
select results_eq($$ select date, usd_cop, valid_from from public.fx_rates where date between '2099-11-13' and '2099-11-17' order by date $$,
  $$ values ('2099-11-13'::date, 3301.9100::numeric, '2099-11-13'::date), ('2099-11-14', 3316.7, '2099-11-14'), ('2099-11-15', 3316.7, '2099-11-14'), ('2099-11-16', 3316.7, '2099-11-14') $$,
  'el fin de semana y el festivo toman el valor y el inicio de su periodo; no guarda días después del límite');
select is(private.upsert_fx_rates(current_setting('test.rows')::jsonb, '2099-11-16'), 0, 'ejecutarla otra vez no cambia nada');
select is(private.upsert_fx_rates(current_setting('test.rows')::jsonb, '2099-11-17'), 1, 'al día siguiente agrega solo el día nuevo');
select is(private.upsert_fx_rates('[{"valor":"3301.95","vigenciadesde":"2099-11-13T00:00:00.000","vigenciahasta":"2099-11-13T00:00:00.000"}]', '2099-11-17'), 1,
  'una corrección oficial reemplaza el valor del día');

select throws_ok($$ select private.upsert_fx_rates('[{"valor":"3400","vigenciadesde":"2099-11-18T00:00:00.000","vigenciahasta":"2099-11-18T00:00:00.000"},{"valor":"x","vigenciadesde":"2099-11-19","vigenciahasta":"2099-11-19"}]', '2099-11-30') $$,
  '22023', 'TRM: fila inválida', 'una fila inválida rechaza el lote');
select is((select count(*) from public.fx_rates where date >= '2099-11-18'), 0::bigint, 'sin guardar nada del lote rechazado');
select throws_ok($$ select private.upsert_fx_rates('[{"valor":"-1","vigenciadesde":"2099-11-18","vigenciahasta":"2099-11-18"}]', '2099-11-30') $$, '22023', 'TRM: fila inválida', 'rechaza valores no positivos');
select throws_ok($$ select private.upsert_fx_rates('[{"valor":"3400","vigenciadesde":"2099-11-18","vigenciahasta":"2099-11-17"}]', '2099-11-30') $$, '22023', 'TRM: fila inválida', 'rechaza periodos al revés');
select throws_ok($$ select private.upsert_fx_rates('{"error":true}', '2099-11-30') $$, '22023', 'TRM: respuesta inválida', 'rechaza una respuesta que no es una lista');

insert into public.fx_rates (date, usd_cop) values ('2099-12-01', 3500);
select is((select valid_from from public.fx_rates where date = '2099-12-01'), '2099-12-01'::date, 'una fila escrita a mano es su propio periodo');

select is((select schedule from cron.job where jobname = 'refresh-fx-rates'), '0 11 * * *', 'corre a las 6:00 a. m. de Bogotá');
select ok(not has_function_privilege('authenticated', 'private.refresh_fx_rates(date)', 'execute'), 'los usuarios no la ejecutan');
select ok(not has_function_privilege('authenticated', 'private.upsert_fx_rates(jsonb, date)', 'execute'), 'ni escriben la TRM');

select * from finish();
rollback;
