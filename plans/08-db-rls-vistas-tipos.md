# Paso 08 — Base de datos: RLS, funciones SQL, vistas y tipos

- **Hito PRD:** H2 (parte 2 de 2) — **H2 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 04, 06, 07
- **Decisiones aplicables (decididas, ver README):** D1, D2, D3

## Objetivo

RLS en todas las tablas, funciones SQL de fechas (espejo de R1) y de creación de extractos, vistas `statement_totals` y `card_balances`, tipos generados y una prueba que demuestre que un segundo usuario no puede leer datos ajenos (criterio de H2 del PRD).

## Diseño

Migración `enable_rls_policies`:

- `alter table … enable row level security` en las 8 tablas.
- Tablas con dueño: políticas separadas `select`, `insert`, `update`, `delete` `to authenticated` con `using ((select auth.uid()) = user_id)` y `with check ((select auth.uid()) = user_id)` (el `select` envuelto mejora el rendimiento).
- `installments` también tiene `user_id` (se rellena desde la RPC) para que la política sea simple. Alternativa: política por `exists` sobre `transactions`; elegir una y anotarla.
- `fx_rates`: solo política `select to authenticated using (true)`. Sin políticas de escritura.
- Revocar permisos a `anon` sobre todas las tablas.

Migración `statement_functions` (espejo SQL de `lib/domain/statements.ts`):

- `public.cutoff_date_for_month(cutoff_day int, y int, m int) returns date`
- `public.statement_cutoff_for(cutoff_day int, d date) returns date`
- `public.statement_period_start(cutoff_day int, cutoff_date date) returns date`
- `public.statement_due_date(payment_day int, cutoff_date date) returns date`
- `public.ensure_statement(p_card_id uuid, p_cutoff_date date) returns uuid`: `insert … on conflict (card_id, cutoff_date) do nothing` y devuelve el id; calcula `period_start` y `due_date` con la tarjeta; si D1 está confirmada, crea el movimiento `handling_fee` del extracto (idempotente). `security invoker` para que aplique RLS.
- Todas `immutable`/`stable` según corresponda y con `set search_path = ''`.

Migración `create_views`:

- `statement_totals` (`with (security_invoker = true)`): por `statement_id`, columnas por concepto (`single_purchases`, `installments`, `subscriptions`, `cash_advances`, `interest`, `handling_fees`, `insurance`, `adjustments`, `refunds`, `payments`) y `total_calculated`. Une movimientos de 1 cuota por `transactions.statement_id` (sumando `amount_cop`) y cuotas por `installments.statement_id` (sumando `total_cop`, D3); excluye movimientos padre con `installments_count > 1`. Nunca suma `amount` ni `total`, que pueden estar en USD.
- `card_balances` (`with (security_invoker = true)`): por tarjeta, `used`, `available`, `utilization` según D2, con `amount_cop` de los movimientos e `interest_cop` de las cuotas facturadas.

Tipos:

- `supabase gen types typescript --local > lib/database.types.ts`.
- Helpers en `lib/supabase/types.ts` (`Tables<'cards'>`, etc.) si no los genera el CLI.

## Tareas

- [ ] Migraciones `enable_rls_policies`, `statement_functions`, `create_views`.
- [ ] `supabase/tests/020-rls.test.sql`: crea usuario A y usuario B en `auth.users`; como A (`set local role authenticated; set local request.jwt.claims = '{"sub":"<A>","role":"authenticated"}'`) inserta tarjeta, extracto, movimiento, cuota y suscripción; como B verifica que **todos** los `select` devuelven 0 filas, que `update`/`delete` afectan 0 filas y que insertar con `user_id = A` falla; como `anon` no se puede leer nada. Incluir las vistas.
- [ ] `supabase/tests/030-statement-functions.test.sql`: replica **los mismos casos** de `lib/domain/__tests__/statements.test.ts` (corte 15 mismo día/día siguiente, corte 31 en febrero normal y bisiesto, meses de 30 días, fecha de pago en el mes siguiente, cambio de año, D7).
- [ ] `supabase/tests/040-views.test.sql`: con datos de ejemplo, `statement_totals` coincide con el cálculo del caso de totales del paso 06; `card_balances` coincide con el caso de cupo. Incluir una compra en USD a 3 cuotas (tabla de referencia del paso 05) y verificar que el extracto suma 141.640 COP en el primer corte, no 35,41.
- [ ] `ensure_statement` llamado dos veces con el mismo corte devuelve el mismo id y no duplica cuota de manejo.
- [ ] Generar `lib/database.types.ts`.
- [ ] `supabase db push` al proyecto remoto (ya con RLS).

## Riesgos

- Vistas sin `security_invoker` ignoran RLS: la prueba de RLS debe incluirlas.
- Divergencia entre R1 en TypeScript y en SQL: mitigada con casos espejo. Si se cambia uno, cambiar el otro en el mismo commit.

## Verificación

```
supabase db reset
supabase test db                                  # todas las pruebas pgTAP pasan
supabase db lint
supabase gen types typescript --local > /tmp/types.ts && diff /tmp/types.ts lib/database.types.ts   # sin diferencias
pnpm typecheck && pnpm lint && pnpm test
supabase migration list                           # remoto al día
```

Comprobación de seguridad en Studio → Advisors (o `supabase inspect db`):

- [ ] Ninguna tabla de `public` sin RLS.
- [ ] Ninguna vista "security definer" en `public`.

## Criterios de terminado

- La prueba con un segundo usuario no puede leer datos ajenos (criterio H2 del PRD) → **H2 terminado**.
- Commit: `feat: add rls policies, statement functions and views`.
- Etiqueta opcional: `git tag h2`.

## Notas de progreso

<!-- Fecha — nota -->
