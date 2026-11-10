-- Datos locales de ejemplo, no son tasas oficiales.
insert into public.fx_rates (date, usd_cop) values ('2026-01-01', 4000), ('2026-01-02', 4010)
on conflict (date) do nothing;
