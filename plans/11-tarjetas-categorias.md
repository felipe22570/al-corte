# Paso 11 — Tarjetas y categorías (CRUD)

- **Hito PRD:** H3 (parte 3 de 3) — **H3 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 08, 10
- **Decisiones aplicables (ver README):** D10 (cambio de día de corte), D11 (colores e iconos de categorías)

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
  - `amortizationMethod` (`fixed_principal` por defecto), `color`: `z.enum(CARD_COLORS)` de `lib/card-colors.ts` (`card-1` … `card-6`), **nunca un hex**. Por defecto, el primer color que no use otra tarjeta activa.
- [ ] `lib/category-icons.ts`: lista curada de ~30 iconos de Lucide para categorías (incluye los 11 de las categorías iniciales del paso 07), mapa nombre kebab-case → componente, con importaciones explícitas (sin cargar todo Lucide). Prueba en Vitest: los 11 iconos iniciales existen en el mapa.
- [ ] `lib/validation/category.ts`: `icon` debe pertenecer a la lista curada.
- [ ] `lib/actions/cards.ts`: `createCard`, `updateCard`, `archiveCard`, `unarchiveCard`. Cada acción: valida con Zod → usa el cliente de servidor (RLS) → `revalidatePath`. Devuelve `{ ok, errors }` tipado.
- [ ] `lib/actions/categories.ts`: `createCategory`, `updateCategory`, `archiveCategory`.
- [ ] Helper `lib/money-input.ts` (o en `lib/validation/`) para parsear montos colombianos (`1.234.567,89`) a string decimal, con pruebas en Vitest.
- [ ] `app/(app)/ajustes/page.tsx`: secciones "Tarjetas" y "Categorías". Server Component que lee de Supabase.
- [ ] `components/card-form.tsx` (client) en `Sheet` (hoja inferior en el celular, lateral en escritorio) para crear y editar. Campos agrupados: datos básicos, fechas, tasas y costos. Un solo botón primary ("Guardar").
- [ ] `components/card-color-picker.tsx`: 6 muestras `bg-card-1`…`bg-card-6` con su nombre en español como etiqueta accesible (Azul, Violeta, Petróleo, Vino, Mostaza, Pizarra), áreas táctiles ≥ 44px, selección indicada con borde y check, no solo con color. Vista previa con `CardColorChip` + nombre + `•••• 1234`.
- [ ] Al editar el día de corte o pago: aviso de que solo aplica a movimientos nuevos (D10). Al editar tasas: aviso de que no recalcula cuotas existentes (F1). Avisos con `Alert` de tono warning y frases cortas.
- [ ] `components/category-form.tsx` con nombre e ícono elegido de la lista curada `lib/category-icons.ts` (D11). Sin selector de color.
- [ ] Lista de tarjetas en `/ajustes`: `CardColorChip` + nombre + banco + `•••• 1234`, cupo con `Money`, tasa con `formatRate` (`28,45% E.A.`), corte y pago ("Corte el 15 · Pago el 5"). Montos alineados a la derecha.
- [ ] Tarjetas archivadas en una sección colapsada, con opción de restaurar; no aparecen en el selector de movimientos.
- [ ] Mostrar solo los últimos 4 dígitos (`•••• 1234`).
- [ ] Estados vacíos con el tono de `AGENTS.md`: "Aún no tienes tarjetas. Agrega la primera."

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

- [ ] Crear una tarjeta con corte 31, pago 15, tasa 28,5% y color Petróleo → en la base `purchase_rate_ea = 0.285000`, `cutoff_day = 31`, `color = 'card-3'`; en la lista se ve `28,50% E.A.`.
- [ ] Forzar `color = '#ff0000'` llamando la acción directamente → error de validación (y la restricción `check` de la base lo rechaza también).
- [ ] El formulario rechaza last4 `12a4`, día 32 y tasa negativa con mensajes en español, tanto en el cliente como si se fuerza el envío (deshabilitar JS o llamar la acción directamente).
- [ ] Editar la tarjeta cambia los datos; aparece el aviso de tasas.
- [ ] Archivar la tarjeta la saca de la lista principal; restaurarla la devuelve.
- [ ] Las 11 categorías iniciales aparecen; crear, renombrar y archivar una funciona.
- [ ] Nombre de categoría duplicado → error amigable (no un error 500).
- [ ] Todo funciona a 360 px y en modo oscuro; los 6 colores de tarjeta se distinguen en ambos temas.
- [ ] `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H3 terminado**.
- Commit: `feat: add cards and categories management`.
- Etiqueta opcional: `git tag h3`.

## Notas de progreso

<!-- Fecha — nota -->
