# Paso 10 — Tarjetas y categorías (CRUD)

- **Hito PRD:** H3 (parte 2 de 2) — **H3 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 08, 09
- **Decisiones aplicables (decididas, ver README):** D10 (cambio de día de corte)

## Objetivo

CRUD completo de tarjetas (F1) y categorías (F8) desde `/ajustes`, con validación Zod compartida entre cliente y servidor.

## Alcance

**Incluye:** listar, crear, editar y archivar/desarchivar tarjetas; listar, crear, editar y archivar categorías.

**No incluye:** borrado físico de tarjetas con movimientos (se archivan); presupuestos por categoría (v2).

## Tareas

- [ ] Instalar `react-hook-form`, `@hookform/resolvers`, `zod`. Componente shadcn `form` si aplica.
- [ ] `lib/validation/card.ts`: esquema Zod con mensajes en español.
  - `name` 1–60, `bank` 1–60, `network` (Visa, Mastercard, American Express, Diners, otra), `last4` regex `^\d{4}$`.
  - `creditLimit`, `advanceFee`, `handlingFee`: string decimal ≥ 0 (se valida con regex + `Decimal`, nunca `Number`).
  - `cutoffDay`, `paymentDay`: enteros 1–31.
  - `purchaseRateEa`, `advanceRateEa`: en la UI se ingresan como porcentaje (28,5) y se guardan como fracción (0,285). Conversión con `Decimal`. Aceptar coma decimal.
  - `amortizationMethod` (`fixed_principal` por defecto), `color` (hex o lista de colores predefinidos).
- [ ] `lib/validation/category.ts`.
- [ ] `lib/actions/cards.ts`: `createCard`, `updateCard`, `archiveCard`, `unarchiveCard`. Cada acción: valida con Zod → usa el cliente de servidor (RLS) → `revalidatePath`. Devuelve `{ ok, errors }` tipado.
- [ ] `lib/actions/categories.ts`: `createCategory`, `updateCategory`, `archiveCategory`.
- [ ] Helper `lib/money-input.ts` (o en `lib/validation/`) para parsear montos colombianos (`1.234.567,89`) a string decimal, con pruebas en Vitest.
- [ ] `app/(app)/ajustes/page.tsx`: secciones "Tarjetas" y "Categorías". Server Component que lee de Supabase.
- [ ] `components/card-form.tsx` (client) en `Sheet`/`Dialog` para crear y editar. Campos agrupados: datos básicos, fechas, tasas y costos.
- [ ] Al editar el día de corte o pago: aviso de que solo aplica a movimientos nuevos (D10). Al editar tasas: aviso de que no recalcula cuotas existentes (F1).
- [ ] `components/category-form.tsx` con nombre, ícono (de lucide) y color.
- [ ] Tarjetas archivadas en una sección colapsada, con opción de restaurar; no aparecen en el selector de movimientos.
- [ ] Mostrar solo los últimos 4 dígitos (`•••• 1234`).

## Pruebas

- [ ] Vitest: esquemas Zod (casos válidos e inválidos: día 0 y 32, last4 con letras, tasa negativa, monto con formato colombiano).
- [ ] Vitest: parser de montos.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test
supabase db reset && supabase test db
pnpm build
```

Comprobaciones manuales (`pnpm dev`, logueado):

- [ ] Crear una tarjeta con corte 31, pago 15, tasa 28,5% → en la base `purchase_rate_ea = 0.285000`, `cutoff_day = 31`.
- [ ] El formulario rechaza last4 `12a4`, día 32 y tasa negativa con mensajes en español, tanto en el cliente como si se fuerza el envío (deshabilitar JS o llamar la acción directamente).
- [ ] Editar la tarjeta cambia los datos; aparece el aviso de tasas.
- [ ] Archivar la tarjeta la saca de la lista principal; restaurarla la devuelve.
- [ ] Las 11 categorías iniciales aparecen; crear, renombrar y archivar una funciona.
- [ ] Nombre de categoría duplicado → error amigable (no un error 500).
- [ ] Todo funciona a 360 px y en modo oscuro.

## Criterios de terminado

- Verificaciones en verde → **H3 terminado**.
- Commit: `feat: add cards and categories management`.
- Etiqueta opcional: `git tag h3`.

## Notas de progreso

<!-- Fecha — nota -->
