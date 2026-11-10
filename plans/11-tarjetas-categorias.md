# Paso 11 — Tarjetas y categorías (CRUD)

- **Hito PRD:** H3 (parte 3 de 3) — **H3 termina aquí**
- **Estado:** ✅ Terminado y verificado
- **Inicio:** 2026-11-10
- **Fin:** 2026-11-10
- **Commit:** d2fd29e
- **Depende de:** 08, 10
- **Decisiones aplicables (ver README):** D10 (cambio de día de corte), D11 (colores e iconos de categorías)

## Objetivo

CRUD completo de tarjetas (F1) y categorías (F8) desde `/ajustes`, con validación Zod compartida entre cliente y servidor.

## Alcance

**Incluye:** listar, crear, editar y archivar/desarchivar tarjetas; listar, crear, editar y archivar categorías.

**No incluye:** borrado físico de tarjetas con movimientos (se archivan); presupuestos por categoría (v2).

## Tareas

- [x] Instalar `react-hook-form`, `@hookform/resolvers`, `zod`.
- [x] `lib/validation/card.ts`: esquema Zod con mensajes en español.
  - `name` 1–60, `bank` 1–60, `network` (Visa, Mastercard, American Express, Diners, otra), `last4` regex `^\d{4}$`.
  - `creditLimit`, `advanceFee`, `handlingFee`: string decimal ≥ 0 (se valida con regex + `Decimal`, nunca `Number`).
  - `cutoffDay`, `paymentDay`: enteros 1–31.
  - `purchaseRateEa`, `advanceRateEa`: en la UI se ingresan como porcentaje (28,5) y se guardan como fracción (0,285). Conversión con `Decimal`. Aceptar coma decimal.
  - `amortizationMethod` (`fixed_principal` por defecto), `color`: `z.enum(CARD_COLORS)` de `lib/card-colors.ts` (`card-1` … `card-6`), **nunca un hex**. Por defecto, el primer color que no use otra tarjeta activa.
- [x] `lib/category-icons.ts`: lista curada de 30 iconos y prueba de los 11 iniciales.
- [x] `lib/validation/category.ts`: validación del icono contra la lista curada.
- [x] `lib/actions/cards.ts`: crear, editar, archivar y restaurar con sesión, validación y RLS.
- [x] `lib/actions/categories.ts`: crear, editar y archivar con sesión, validación y RLS.
- [x] `lib/money-input.ts`: parser de montos colombianos con pruebas.
- [x] `app/(app)/ajustes/page.tsx`: secciones de tarjetas y categorías con lecturas de Supabase.
- [x] `components/card-form.tsx`: hoja adaptable y campos agrupados.
- [x] `components/card-color-picker.tsx`: seis colores accesibles y vista previa.
- [x] Avisos al editar fechas o tasas.
- [x] `components/category-form.tsx`: nombre e icono sin selector de color.
- [x] Lista de tarjetas con nombre, banco, últimos dígitos, cupo, tasa y fechas.
- [x] Tarjetas archivadas en sección colapsada con restauración. El selector de movimientos se implementará en el paso 12.
- [x] Mostrar solo los últimos 4 dígitos (`•••• 1234`).
- [x] Estados vacíos en el tono de `AGENTS.md`.

## Pruebas

- [x] Vitest: esquemas Zod con casos válidos e inválidos.
- [x] Vitest: parser de montos.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test
supabase db reset && supabase test db
pnpm build
```

Comprobaciones manuales (`pnpm dev`, logueado):

- [x] Tarjeta con corte 31, pago 15, tasa 28,5% y color Petróleo guardada y verificada en base y lista.
- [x] Color hexadecimal rechazado por validación de acción y restricción de base.
- [x] Esquema rechaza últimos dígitos, días y tasas inválidos; el formulario presenta errores en español.
- [x] Editar tarjeta cambia los datos y muestra aviso de tasas.
- [x] Archivar y restaurar tarjeta.
- [x] Categorías iniciales y creación, edición y archivado de una categoría.
- [x] Nombre duplicado muestra un error amigable.
- [x] Revisado a 360 px y en modo oscuro; seis colores distintos en ambos temas.
- [x] `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H3 terminado**.
- Commit: `feat: add cards and categories management`.
- Etiqueta opcional: `git tag h3`.

## Notas de progreso

2026-11-10 — Dependencias previstas instaladas. Implementados parser de montos colombianos, esquemas Zod, catálogo curado de iconos, acciones protegidas por sesión/RLS y la primera versión de Ajustes con formularios, archivado y restauración de tarjetas. Las lecturas de montos y tasas solicitan texto a PostgREST para evitar operar dinero con `number`. Pasan `pnpm typecheck`, `pnpm lint`, 59 pruebas Vitest y `pnpm build`. La validación integrada con Supabase local y la revisión visual siguen pendientes: Docker dejó de estar disponible durante la tarea. No se realizaron migraciones ni cambios remotos.

2026-11-10 — Docker disponible. Verificados con usuario temporal local creación, edición y reapertura de tarjeta y categoría, archivado/restauración de tarjeta, archivado de categoría, duplicados y validación de campos. Se confirmó en base corte 31, tasa 0,285 y color `card-3`; se revisaron los seis colores y los formularios a 360 px, en claro y oscuro. Pasan 60 pruebas Vitest, 81 pgTAP, tipos, lint, `db lint` y build. El usuario temporal se eliminó. Pendiente reinicio local con autorización; no hubo cambios de esquema ni remotos.

2026-11-10 — Reinicio local autorizado y completado; todas las migraciones y el seed se aplican desde cero, pasan 81 pruebas pgTAP y `db lint`. H3 terminado. El reinicio eliminó los usuarios y datos locales; no hubo cambios remotos.
