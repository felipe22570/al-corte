-- Step 38 (H11, D57): official TRM loaded daily into fx_rates from datos.gov.co (dataset 32sa-8pi3).
-- A SQL function with the http extension, called by pg_cron: no function deployment and no keys stored anywhere.

create extension if not exists http with schema extensions;

-- One row per calendar day; valid_from is the start of the official period in force that day (D52).
alter table public.fx_rates add column valid_from date;
update public.fx_rates set valid_from = date where valid_from is null;
-- Rows written by hand (seed, tests) without a period start in force are their own period.
create function private.set_fx_rate_valid_from()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.valid_from := coalesce(new.valid_from, new.date);
  return new;
end;
$$;
create trigger fx_rates_valid_from before insert or update on public.fx_rates for each row execute function private.set_fx_rate_valid_from();
alter table public.fx_rates
  alter column valid_from set not null,
  add constraint fx_rates_valid_from_check check (valid_from <= date and date - valid_from <= 10);
comment on column public.fx_rates.valid_from is 'Start of the official period in force that day (vigenciadesde); weekends and holidays share it.';

-- Expands each official period into calendar days up to p_until and upserts them. Idempotent: an unchanged day is not
-- rewritten. Rejects the whole batch when a row is malformed, so nothing partial is stored.
create function private.upsert_fx_rates(p_rows jsonb, p_until date)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row jsonb;
  v_value numeric;
  v_from date;
  v_to date;
  v_count integer := 0;
  v_changed integer;
begin
  if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'TRM: respuesta inválida' using errcode = '22023'; end if;
  for v_row in select value from jsonb_array_elements(p_rows) loop
    begin
      v_value := (v_row->>'valor')::numeric;
      v_from := left(v_row->>'vigenciadesde', 10)::date;
      v_to := left(v_row->>'vigenciahasta', 10)::date;
    exception when others then
      raise exception 'TRM: fila inválida' using errcode = '22023';
    end;
    if v_value is null or v_from is null or v_to is null or v_value::text in ('NaN', 'Infinity', '-Infinity') or v_value <= 0
       or v_value > 99999999.9999 or v_to < v_from or v_to - v_from > 10 then
      raise exception 'TRM: fila inválida' using errcode = '22023';
    end if;
    insert into public.fx_rates (date, usd_cop, valid_from)
    select day::date, round(v_value, 4), v_from from generate_series(v_from, least(v_to, p_until), interval '1 day') as day
    on conflict (date) do update set usd_cop = excluded.usd_cop, valid_from = excluded.valid_from
    where (public.fx_rates.usd_cop, public.fx_rates.valid_from) is distinct from (excluded.usd_cop, excluded.valid_from);
    get diagnostics v_changed = row_count;
    v_count := v_count + v_changed;
  end loop;
  return v_count;
end;
$$;
revoke all on function private.upsert_fx_rates(jsonb, date) from public, anon, authenticated;

-- Reads the official TRM of the periods that end on or after p_since (by default, the last 30 days) and stores each day
-- up to today in Bogotá, so "the latest row" stays today's TRM (D4). On any failure it raises and stores nothing.
create function private.refresh_fx_rates(p_since date default null)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'America/Bogota')::date;
  v_since date := coalesce(p_since, v_today - 30);
  v_response extensions.http_response;
begin
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '10');
  v_response := extensions.http_get('https://www.datos.gov.co/resource/32sa-8pi3.json?$where='
    || extensions.urlencode(format('vigenciahasta >= ''%s''', v_since)) || '&$order=vigenciadesde&$limit=5000');
  if v_response.status <> 200 then raise exception 'TRM: datos.gov.co respondió %', v_response.status; end if;
  return private.upsert_fx_rates(v_response.content::jsonb, v_today);
end;
$$;
revoke all on function private.refresh_fx_rates(date) from public, anon, authenticated;
comment on function private.refresh_fx_rates(date) is
  'Daily TRM (D57). Initial load: select private.refresh_fx_rates(''2026-01-01''); in the SQL editor.';

-- 6:00 a. m. in Bogotá (UTC − 5).
select cron.schedule('refresh-fx-rates', '0 11 * * *', 'select private.refresh_fx_rates()');
