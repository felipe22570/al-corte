# Paso 15 — Suscripciones y cobro diario con pg_cron

- **Hito PRD:** H6 — **H6 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 06, 08, 14
- **Decisiones aplicables (decididas, ver README):** D4 (TRM para suscripciones en USD), regla de primer cobro con prueba gratis (paso 06)

## Objetivo

CRUD de suscripciones y pantalla `/suscripciones` (F4), y la función SQL `generate_subscription_charges()` programada con `pg_cron` todos los días a las 5:00 a. m. de Bogotá (10:00 UTC), idempotente y con recuperación de 7 días (R4, PRD sección 9).

## Diseño

Función SQL (migración `subscription_charges_job`), `security definer`, `set search_path = ''`, ejecutada como `postgres` por `pg_cron`:

```
generate_subscription_charges(p_today date default (now() at time zone 'America/Bogota')::date)
```

1. Para cada suscripción `active` con tarjeta no archivada, calcula las fechas de cobro en `[p_today − 6, p_today]` que sean ≥ `start_date` y ≥ `trial_ends_at` (si existe). Debe replicar `chargeDatesBetween` del paso 06 (incluido el ajuste de fin de mes y la regla anual).
2. Por cada fecha: `ensure_statement` con el corte de esa fecha (usar una variante interna que reciba `user_id`, porque aquí no hay `auth.uid()`).
3. Inserta el movimiento `purchase`, `source = 'subscription'`, `subscription_id`, `user_id` de la suscripción, categoría de la suscripción, `installments_count = 1`, monto y moneda; si es USD, `fx_rate` según D4 y `amount_cop`. `on conflict (subscription_id, date) where subscription_id is not null do nothing`.
4. Actualiza `last_charged_amount`.
5. Devuelve el número de cobros creados.

Programación (misma migración):

```sql
create extension if not exists pg_cron;
select cron.schedule('generate-subscription-charges', '0 10 * * *',
  $$select public.generate_subscription_charges()$$);
```

Revocar `execute` de la función a `anon` y `authenticated` (solo la ejecuta el cron).

## Tareas

- [ ] Migración `subscription_charges_job`.
- [ ] Pruebas pgTAP `070-subscription-charges.test.sql`:
  - Ejecutar dos veces el mismo día → no duplica (idempotencia).
  - Recuperación: suscripción que cobraba hace 3 días y no se generó → se crea con su fecha original y el extracto correcto.
  - Día de cobro 31 en febrero (normal y bisiesto) → cobro el 28/29.
  - Anual: solo cobra en su mes; renovación en año bisiesto.
  - Pausada, cancelada, en prueba gratis o con tarjeta archivada → no genera.
  - El cobro de la fecha de corte va a ese extracto; el del día siguiente, al siguiente.
  - USD: usa la TRM de D4; sin TRM disponible no genera nada (y no falla).
  - Los cobros quedan con el `user_id` del dueño de la suscripción (no se mezclan usuarios).
  - `authenticated` no puede ejecutar la función.
- [ ] Regenerar tipos.
- [ ] `lib/validation/subscription.ts` y `lib/actions/subscriptions.ts`: crear, editar, pausar, reanudar, cancelar.
- [ ] Al crear una suscripción cuya fecha de cobro de hoy ya pasó la hora del cron: decidir si se genera el cobro inmediatamente (llamando una RPC `generate_charges_for_subscription(id)` con permisos del usuario) o se espera al día siguiente. **Propuesta:** generar al guardar para no perder cobros de hoy; anotar decisión.
- [ ] `app/(app)/suscripciones/page.tsx`:
  - Totales: costo mensual total como monto protagonista (`text-amount-lg`) y anual equivalente debajo (`subscriptionTotals`, USD convertido con la última TRM y marcado como "estimado").
  - Lista: nombre, tarjeta (`CardColorChip` + nombre), valor (`Money`, a la derecha; USD como `US$ 15,99`), frecuencia, próximo cobro (`DateLabel`, p. ej. "vie 15 nov"), estado con `StatusBadge` (activa: sin badge o neutral; pausada y cancelada: neutral con texto).
  - Sección "Pruebas por vencer" (`isTrialEndingSoon`) con badge warning y texto ("La prueba termina en 2 días").
  - Estado vacío: "Aún no tienes suscripciones. Agrega la primera."
  - Formulario en `Sheet` para crear/editar, con un solo botón primary.
- [ ] Enlace desde el movimiento generado a su suscripción y viceversa (últimos cobros).

## Verificación

```
supabase db reset && supabase test db
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

Comprobar el cron en local (`psql` o SQL editor de Studio):

```sql
select jobname, schedule, command from cron.job;          -- 1 fila, '0 10 * * *'
select public.generate_subscription_charges();            -- devuelve n
select public.generate_subscription_charges();            -- devuelve 0 (idempotente)
select * from cron.job_run_details order by start_time desc limit 5;  -- tras la hora programada
```

Comprobaciones manuales:

- [ ] Crear una suscripción mensual con día de cobro = hoy → aparece su movimiento con origen "suscripción" en el extracto correcto.
- [ ] Pausarla y ejecutar la función → no se crean cobros nuevos.
- [ ] Los totales mensual y anual coinciden con un cálculo a mano.
- [ ] Una prueba gratis que vence en 3 días aparece en "Pruebas por vencer".
- [ ] En el proyecto remoto (tras `supabase db push`): `cron.job` tiene el trabajo programado.
- [ ] 360 px y modo oscuro correctos; `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H6 terminado**.
- Commit: `feat: add subscriptions with daily charge generation`.
- Etiqueta opcional: `git tag h6`.

## Notas de progreso

<!-- Fecha — nota -->
