# Paso 07 — Base de datos: tablas, restricciones e índices

- **Hito PRD:** H2 (parte 1 de 2)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 02 (puede hacerse en paralelo con 04–06)
- **Decisiones aplicables (decididas, ver README):** D1 (cuota de manejo automática → valor `system` en `source`), D9 (categorías iniciales), D3 (columnas `_cop` en `installments`), D11 (categorías sin color)

## Objetivo

Migraciones con las 8 tablas del PRD (sección 6), sus tipos enumerados, restricciones, índices y categorías iniciales.

## Alcance

**Incluye:** tablas, enums, `check`, únicos, índices, FKs, trigger de categorías iniciales, `seed.sql` de desarrollo.

**No incluye:** RLS, vistas, funciones de negocio ni tipos generados (paso 08). Como RLS se activa en el paso 08, **no** se hace `supabase db push` al remoto hasta terminar el paso 08.

## Diseño

Migración `supabase migration new create_core_schema`:

- Enums: `amortization_method` (`fixed_principal`, `french`), `transaction_type` (`purchase`, `cash_advance`, `advance_fee`, `payment`, `handling_fee`, `interest`, `insurance`, `refund`, `adjustment`), `transaction_source` (`manual`, `subscription`, `import`, `email`, `system`*), `currency_code` (`COP`, `USD`), `subscription_frequency` (`monthly`, `yearly`), `subscription_status` (`active`, `paused`, `cancelled`).
  - *`system` solo si se confirma D1.
- Columnas comunes: `id uuid primary key default gen_random_uuid()`, `user_id uuid not null default auth.uid() references auth.users on delete cascade`, `created_at timestamptz not null default now()`, `updated_at timestamptz` con trigger `set_updated_at` en tablas editables.
- `cards`: campos del PRD; `last4 char(4) check (last4 ~ '^[0-9]{4}$')`; `cutoff_day`/`payment_day smallint check between 1 and 31`; tasas `numeric(9,6) check >= 0` (E.A. como fracción, 0,2899); `credit_limit`, `advance_fee`, `handling_fee numeric(14,2) check >= 0`; `amortization_method default 'fixed_principal'`; `color text not null default 'card-1' check (color in ('card-1','card-2','card-3','card-4','card-5','card-6'))` (clave del token de `globals.css`, nunca un hex, según `AGENTS.md`); `archived_at timestamptz`.
- `statements`: `card_id` FK `on delete restrict`; `period_start`, `cutoff_date`, `due_date date not null`; `real_total numeric(14,2)`; `paid_at timestamptz`; `unique (card_id, cutoff_date)`; `check (period_start <= cutoff_date and cutoff_date < due_date)`.
- `categories`: `name`, `icon text not null` (nombre de un icono de Lucide en kebab-case, de la lista curada de `lib/category-icons.ts`), `color text` (se conserva por el PRD pero queda en `null` y sin uso en el MVP, D11), `monthly_budget numeric(14,2)` (v2); `unique (user_id, name)`; `archived_at` para no romper movimientos históricos.
- `transactions`: campos del PRD; `amount numeric(14,2) check > 0`; `fx_rate numeric(12,4)`; `amount_cop numeric(14,2) not null` (para COP = `amount`); `check (currency = 'COP' or fx_rate is not null)`; `installments_count smallint not null default 1 check between 1 and 48`; `interest_free boolean default false`; `rate_ea_applied numeric(9,6)`; `parent_id` FK a `transactions on delete cascade`; `subscription_id` FK `on delete set null`; `source default 'manual'`; `verified boolean default false`; `note text`.
- `installments`: `transaction_id` FK `on delete cascade`; `statement_id` FK; `number smallint`; `principal`, `interest`, `total`, `balance_after numeric(14,2)` en la moneda de la compra; `principal_cop`, `interest_cop`, `total_cop numeric(14,2) not null` con el equivalente en COP (D3; columnas adicionales a las del PRD, iguales a las originales si la compra es en COP); `unique (transaction_id, number)`; `check (total = principal + interest)` y `check (total_cop = principal_cop + interest_cop)`.
- `subscriptions`: campos del PRD; `billing_day check between 1 and 31`; `last_charged_amount numeric(14,2)`.
- `fx_rates`: `date date primary key` (o `id` + `unique(date)`), `usd_cop numeric(12,4) not null check > 0`, **sin `user_id`** (ver contradicción en `README.md`).
- `notification_log`: `kind text`, `ref_id uuid`, `scheduled_for date`, `sent_at timestamptz`; `unique (user_id, kind, ref_id, scheduled_for)` (v2).

Índices y restricciones clave del PRD:

- `create unique index … on transactions (subscription_id, date) where subscription_id is not null;`
- `transactions (card_id, date)`, `transactions (statement_id)`, `installments (statement_id)`.
- Extras: `transactions (user_id, date desc)` para el historial; `subscriptions (status)`; índice único parcial de D1 si se confirma.

Categorías iniciales (D9), migración `seed_default_categories`:

- Función `public.create_default_categories(p_user_id uuid)` idempotente (`on conflict do nothing`).
- Trigger `after insert on auth.users` que la llama (`security definer`, `set search_path = ''`).
- `select create_default_categories(id) from auth.users;` para usuarios existentes.
- Lista con su icono de Lucide: Mercado (`shopping-cart`), Restaurantes (`utensils`), Transporte (`car`), Servicios (`receipt`), Salud (`heart-pulse`), Entretenimiento (`clapperboard`), Suscripciones (`repeat`), Viajes (`plane`), Educación (`graduation-cap`), Hogar (`house`), Otros (`ellipsis`). Los nombres se guardan con mayúscula inicial y tildes. Los iconos deben existir en `lib/category-icons.ts` (paso 11); si cambia la versión de `lucide-react`, verificar que existan.

`supabase/seed.sql` (solo local): un par de filas en `fx_rates`. No crear usuarios aquí.

## Tareas

- [ ] Migración `create_core_schema`.
- [ ] Migración `seed_default_categories`.
- [ ] `supabase/seed.sql`.
- [ ] Pruebas pgTAP `supabase/tests/010-schema.test.sql`: existen las 8 tablas, `has_column` de columnas clave, `col_type_is` `numeric(14,2)` y `date` donde corresponde, `check` de días rechaza 0 y 32, único `(card_id, cutoff_date)`, único parcial de suscripciones.
- [ ] Prueba pgTAP de categorías: insertar un usuario en `auth.users` dentro de la prueba → tiene 11 categorías, todas con `icon`.
- [ ] Prueba pgTAP: `cards.color = '#ff0000'` o `'card-7'` → viola el `check`.

## Riesgos

- Editar una migración ya aplicada: prohibido. Si algo falla después de aplicarla en remoto, crear una migración nueva.
- `auth.uid()` como default no funciona en el cron (no hay JWT): el cron debe pasar `user_id` explícito (paso 15).

## Verificación

```
supabase db reset             # aplica migraciones y seed sin errores
supabase test db              # pruebas de esquema en verde
supabase db lint              # sin errores
pnpm typecheck && pnpm lint && pnpm test
```

Comprobaciones manuales (Studio o `psql`):

- [ ] `\d public.transactions` muestra montos `numeric(14,2)` y `date` como `date`.
- [ ] No hay columnas para número completo de tarjeta, CVV ni vencimiento.
- [ ] `select count(*) from categories where user_id = '<dueño>'` = 11 tras crear el usuario en Studio.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add core database schema`.

## Notas de progreso

<!-- Fecha — nota -->
