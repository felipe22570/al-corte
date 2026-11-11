# Paso 15 — Suscripciones y cobro diario con pg_cron

- **Hito PRD:** H6 — **H6 termina aquí**
- **Estado:** ✅ Terminado y aceptado
- **Inicio:** 2026-11-10
- **Fin:** 2026-11-11
- **Commit:** ver historial de git (`feat: add subscriptions with daily charge generation`)
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

- [x] Migración `subscription_charges_job`.
- [x] Pruebas pgTAP `070-subscription-charges.test.sql`:
  - Ejecutar dos veces el mismo día → no duplica (idempotencia).
  - Recuperación: suscripción que cobraba hace 3 días y no se generó → se crea con su fecha original y el extracto correcto.
  - Día de cobro 31 en febrero (normal y bisiesto) → cobro el 28/29.
  - Anual: solo cobra en su mes; renovación en año bisiesto.
  - Pausada, cancelada, en prueba gratis o con tarjeta archivada → no genera.
  - El cobro de la fecha de corte va a ese extracto; el del día siguiente, al siguiente.
  - USD: usa la TRM de D4; sin TRM disponible no genera nada (y no falla).
  - Los cobros quedan con el `user_id` del dueño de la suscripción (no se mezclan usuarios).
  - `authenticated` no puede ejecutar la función.
- [x] Regenerar tipos.
- [x] `lib/validation/subscription.ts` y `lib/actions/subscriptions.ts`: crear, editar, pausar, reanudar, cancelar.
- [x] Al crear una suscripción cuyo cobro corresponde a hoy, generarlo inmediatamente mediante una RPC con permisos del usuario.
- [x] `app/(app)/suscripciones/page.tsx`:
  - Totales: costo mensual total como monto protagonista (`text-amount-lg`) y anual equivalente debajo (`subscriptionTotals`, USD convertido con la última TRM y marcado como "estimado").
  - Lista: nombre, tarjeta (`CardColorChip` + nombre), valor (`Money`, a la derecha; USD como `US$ 15,99`), frecuencia, próximo cobro (`DateLabel`, p. ej. "vie 15 nov"), estado con `StatusBadge` (activa: sin badge o neutral; pausada y cancelada: neutral con texto).
  - Sección "Pruebas por vencer" (`isTrialEndingSoon`) con badge warning y texto ("La prueba termina en 2 días").
  - Estado vacío: "Aún no tienes suscripciones. Agrega la primera."
  - Formulario en `Sheet` para crear/editar, con un solo botón primary.
- [x] Enlace desde el movimiento generado a su suscripción y viceversa (últimos cobros).

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

- [x] Crear una suscripción mensual con día de cobro = hoy → aparece su movimiento con origen "suscripción" en el extracto correcto.
- [x] Pausarla y ejecutar la función → no se crean cobros nuevos.
- [x] Los totales mensual y anual coinciden con un cálculo a mano.
- [x] Una prueba gratis que vence en 3 días aparece en "Pruebas por vencer".
- [x] En el proyecto remoto (tras `supabase db push`): `cron.job` tiene el trabajo programado.
- [x] 360 px y modo oscuro revisados; `pnpm lint` (incluye `check-design`) sin hallazgos. La interacción tras navegar al fragmento fue aceptada por el dueño, sin validación táctil real.

## Criterios de terminado

- Verificaciones en verde → **H6 terminado**.
- Commit: `feat: add subscriptions with daily charge generation`.
- Etiqueta opcional: `git tag h6`.

## Notas de progreso

2026-11-10 — El dueño aprobó el plan y generar al guardar el cobro que corresponda a hoy, sin esperar al siguiente cron. La migración se probará primero en local; no se desplegará en remoto sin autorización expresa. No se prevén dependencias nuevas.

2026-11-11 — Implementados la migración local del cron, generación inmediata para el dueño, validación, acciones y pantalla de suscripciones. Antes del reinicio del entorno pasaron 143 pruebas pgTAP y `db lint`; en Chrome a 360 px se creó una suscripción con cobro inmediato, se pausó y se comprobó que no generaba otro cobro; se editaron y mostraron una prueba gratis y los totales. Pasan 93 Vitest con cobertura de dominio 100%, tipos y lint. El entorno se reinició y Docker dejó de responder; `sudo -n service docker start` requiere contraseña. Queda pendiente reactivar Docker, completar las pruebas de interfaz y cron, eliminar únicamente la cuenta local temporal `paso15-test-65218@example.com`, revisar el build y consultar autorización para desplegar la migración remota. El paso sigue en progreso, sin commit.

2026-11-11 — Docker volvió a estar disponible. En Chrome a 360 px y modo oscuro se comprobó la prueba gratis, los enlaces entre suscripción y movimiento, reanudar y cancelar mediante teclado y una suscripción anual USD con cobro inmediato de US$ 15,99 a TRM 4.010 ($64.120 COP); totales $17.343 mensuales y $208.120 anuales, estimados. El clic automatizado de Chrome no activó Reanudar en esta sesión, aunque sí lo hizo Enter con el botón enfocado; queda pendiente confirmar la interacción táctil real o descartar un problema de automatización. La cuenta local temporal se eliminó. El cron local existe con horario `0 10 * * *`; dos ejecuciones manuales no duplicaron cobros, pero aún no hay registros de ejecución programada en `cron.job_run_details`. Pasan 151 pgTAP, 93 Vitest con cobertura de dominio 100%, tipos, lint, build y `db lint` local. La simulación remota propone solo `20261110050000_subscription_charges_job.sql`; no se aplicó. Sin nuevo `db reset`, ni commit; paso aún en progreso.

2026-11-11 — Con autorización se ejecutó `supabase db reset` local y se aplicó la migración al remoto. Pasaron de nuevo 151 pgTAP, tipos, lint, 93 Vitest con cobertura de dominio del 100 % y `db lint` local y remoto; el build había pasado tras el último cambio de aplicación. El remoto no tiene migraciones pendientes y su cron está activo a las 10:00 UTC; no se verificó una ejecución programada remota. Un trabajo temporal local con el mismo comando registró dos ejecuciones `succeeded` y se eliminó; solo quedó el cron principal y se confirmó la eliminación de ambas cuentas temporales. En una segunda sesión el clic automatizado reanudó en la ruta normal, pero no pausó después de navegar al fragmento; sigue sin determinarse si es un defecto o una limitación de automatización. No se ha validado interacción táctil real. El paso permanece en progreso, sin commit.

2026-11-11 — El dueño aprueba la interacción pendiente y autoriza cerrar el paso. Esa aceptación no constituye una prueba táctil real ni determina la causa del comportamiento observado en la automatización. Tampoco se ha comprobado una ejecución programada del cron remoto.
