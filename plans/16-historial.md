# Paso 16 — Historial con filtros y gráficos

- **Hito PRD:** H7 (parte 2 de 2) — **H7 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 15
- **Decisiones aplicables (decididas, ver README):** D5

## Objetivo

Pantalla `/movimientos` (F7): lista agrupada por día con filtros por mes, tarjeta, categoría, tipo y texto del comercio; gráfico de gasto mensual de los últimos 12 meses y gasto por categoría del mes elegido.

## Diseño

- Filtros en la URL (`searchParams`): `mes=YYYY-MM` (por defecto el actual en Bogotá), `tarjeta`, `categoria`, `tipo`, `q`. La página es Server Component; el formulario de filtros es client y solo actualiza la URL (compartible y con botón atrás funcional).
- Filtro por mes = fecha del movimiento dentro del mes calendario (no por extracto). Anotar.
- `q`: `ilike` sobre `merchant` y `note`, escapando `%` y `_`.
- Lista agrupada por día, del más reciente al más antiguo; subtotal por día. Cada fila: comercio, categoría (ícono y color), tarjeta, valor (abonos en verde con signo), cuotas (ej. "6 cuotas") y enlace al detalle.
- Paginación o "Cargar más" si el mes tiene muchos movimientos (> 100).
- Gráficos (Recharts vía shadcn `chart`, componentes client que reciben datos ya agregados en el servidor como strings):
  - Barras: gasto por mes de los últimos 12 meses (D5), respetando filtros de tarjeta y categoría.
  - Torta o barras horizontales: gasto por categoría del mes elegido.
- Agregaciones con `Decimal` en el servidor (funciones puras en `lib/domain/`) o con SQL (`sum` sobre `numeric`). Recharts recibe `number` **solo para dibujar**; las etiquetas y tooltips usan `formatMoney` sobre el string original.

## Tareas

- [ ] Instalar `recharts` y el componente `chart` de shadcn/ui.
- [ ] `lib/validation/history-filters.ts`: Zod para `searchParams` (valores inválidos se ignoran, no rompen la página).
- [ ] Funciones puras con pruebas: agrupar por día, gasto de los últimos 12 meses (rellena meses sin datos con 0), gasto por categoría.
- [ ] `app/(app)/movimientos/page.tsx`, `components/history-filters.tsx`, `components/transaction-list.tsx`, `components/monthly-spending-chart.tsx`, `components/category-spending-chart.tsx`.
- [ ] Estado vacío: "No hay movimientos con estos filtros" + botón para limpiar filtros.
- [ ] Colores de gráficos con variables CSS que funcionen en modo oscuro.

## Pruebas

- [ ] Vitest: agrupación por día; 12 meses con huecos; meses que cruzan de año (dic → ene); gasto por categoría excluye pagos e incluye devoluciones como resta (D5).
- [ ] Vitest: esquema de filtros con valores inválidos.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

Comprobaciones manuales (con datos de varios meses):

- [ ] Cada filtro reduce la lista correctamente; combinados también.
- [ ] Buscar "netf" encuentra "Netflix"; buscar `%` no rompe ni devuelve todo.
- [ ] Copiar la URL con filtros y abrirla en otra pestaña muestra lo mismo.
- [ ] El gráfico de 12 meses muestra 12 barras, incluidas las de valor 0.
- [ ] El total del gráfico por categoría del mes = gasto del mes del tablero (mismos filtros).
- [ ] Tooltips con formato COP.
- [ ] 360 px: filtros en un `Sheet` o plegables, gráficos legibles, sin scroll horizontal.
- [ ] Modo oscuro: ejes, textos y colores legibles.

## Criterios de terminado

- Verificaciones en verde → **H7 terminado**.
- Commit: `feat: add transaction history with filters and charts`.
- Etiqueta opcional: `git tag h7`.

## Notas de progreso

<!-- Fecha — nota -->
