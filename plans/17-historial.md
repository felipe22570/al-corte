# Paso 17 — Historial con filtros y gráficos

- **Hito PRD:** H7 (parte 2 de 2) — **H7 termina aquí**
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-11
- **Fin:** 2026-11-11
- **Commit:** ver historial de git (`feat: add transaction history with filters and charts`)
- **Depende de:** 16
- **Decisiones aplicables (decididas, ver README):** D5, D11

## Objetivo

Pantalla `/movimientos` (F7): lista agrupada por día con filtros por mes, tarjeta, categoría, tipo y texto del comercio; gráfico de gasto mensual de los últimos 12 meses y gasto por categoría del mes elegido.

## Diseño

- Filtros en la URL (`searchParams`): `mes=YYYY-MM` (por defecto el actual en Bogotá), `tarjeta`, `categoria`, `tipo`, `q`. La página es Server Component; el formulario de filtros es client y solo actualiza la URL (compartible y con botón atrás funcional).
- Filtro por mes = fecha del movimiento dentro del mes calendario (no por extracto). Anotar.
- `q`: `ilike` sobre `merchant` y `note`, escapando `%` y `_`.
- Lista agrupada por día, del más reciente al más antiguo; subtotal por día. Cada fila: comercio (`text-body`), categoría (icono Lucide `size-5` en `text-muted-foreground`), tarjeta (`CardColorChip` + nombre corto), valor a la derecha con `text-amount` (abonos con signo `+` y la etiqueta "Abono", **sin verde**: el verde solo significa "al día"), cuotas (ej. "6 cuotas") y enlace al detalle. Encabezado de día con `formatDateWithWeekday` ("vie 15 nov") y subtotal a la derecha.
- Paginación o "Cargar más" si el mes tiene muchos movimientos (> 100).
- Gráficos (Recharts vía shadcn `chart`, componentes client que reciben datos ya agregados en el servidor como strings):
  - Barras: gasto por mes de los últimos 12 meses (D5), respetando filtros de tarjeta y categoría. Barras apiladas por tarjeta con `var(--card-N)` de cada tarjeta y leyenda con nombre + últimos 4 dígitos (regla de `AGENTS.md`); con filtro de una sola tarjeta, una serie.
  - Barras horizontales: gasto por categoría del mes elegido, ordenadas de mayor a menor, **en un solo color neutro** (`var(--foreground)` o `var(--muted-foreground)`), con icono y nombre de la categoría y el monto en texto (D11). Sin torta: es menos legible a 360 px.
  - Ejes, rejilla y tooltips con `var(--border)`, `var(--muted-foreground)` y `bg-popover`; montos del eje y del tooltip con `lib/format.ts`. Ningún hex en las props de Recharts.
- Agregaciones con `Decimal` en el servidor (funciones puras en `lib/domain/`) o con SQL (`sum` sobre `numeric`). Recharts recibe `number` **solo para dibujar**; las etiquetas y tooltips usan `formatMoney` sobre el string original.

## Tareas

- [x] Instalar `recharts`; gráficos adaptados directamente a los tokens existentes, sin agregar un componente `chart` de shadcn ni dependencias adicionales.
- [x] `lib/validation/history-filters.ts`: Zod para `searchParams` (valores inválidos se ignoran, no rompen la página).
- [x] Funciones puras con pruebas: agrupar por día, gasto de los últimos 12 meses (rellena meses sin datos con 0), gasto por categoría.
- [x] `app/(app)/movimientos/page.tsx`, `components/history-filters.tsx`, `components/transaction-list.tsx`, `components/monthly-spending-chart.tsx`, `components/category-spending-chart.tsx`.
- [x] Estado vacío: "No hay movimientos con estos filtros" + botón para limpiar filtros.
- [x] Colores de gráficos solo con `var(--card-N)` y neutros del tema, para que cambien solos en modo oscuro.
- [x] Adaptar gráficos a las reglas del paso 09 (radios, texto y bordes; tooltip sin sombra).

## Pruebas

- [x] Vitest: agrupación por día; 12 meses con huecos; meses que cruzan de año (dic → ene); gasto por categoría excluye pagos e incluye devoluciones como resta (D5).
- [x] Vitest: esquema de filtros con valores inválidos.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
pnpm build
```

Comprobaciones manuales (con datos de varios meses):

- [x] Filtros de mes, tarjeta, categoría, tipo y búsqueda, incluidos filtros combinados.
- [x] Buscar "netf" encuentra "Netflix"; buscar `%` no rompe ni devuelve todo.
- [x] Copiar la URL con filtros y abrirla en otra pestaña muestra lo mismo.
- [x] El gráfico de 12 meses incluye los 12 meses, incluidos los de valor 0.
- [x] El total del gráfico por categoría del mes = gasto del mes del tablero (mismos filtros).
- [x] Tooltips y ejes con formato de pesos; tooltips comprobados mediante eventos de navegador simulados.
- [x] Cada serie de tarjeta usa el mismo color que el chip de esa tarjeta en el resto de la app.
- [x] 360 px: filtros plegables, gráficos legibles, sin scroll horizontal.
- [x] Modo oscuro: ejes, textos y colores revisados.
- [x] `pnpm lint` (incluye `check-design`) sin hallazgos.

## Criterios de terminado

- Verificaciones en verde → **H7 terminado**.
- Commit: `feat: add transaction history with filters and charts`.
- Etiqueta opcional: `git tag h7`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-11 — El dueño aprobó el plan y la instalación de Recharts. El mes corresponde a la fecha del movimiento, no al corte. Se usarán datos temporales locales para validar la interfaz.

2026-11-11 — Instalado Recharts; añadidas funciones de agrupación y agregación con pruebas y validación inicial de filtros. Pasan 103 Vitest con cobertura de dominio del 100 %. La pantalla y los gráficos aún no están implementados; paso en progreso, sin commit.

2026-11-11 — Implementados los filtros compartibles, lista agrupada con paginación y gráficos usando Recharts directamente con tokens del tema, sin generar el adaptador shadcn previsto. La búsqueda literal se aplica en el servidor a comercio y nota, por lo que `%` y `_` no son comodines; los gráficos respetan los filtros de tarjeta y categoría. En Chrome de producción local a 360 px y modo oscuro se comprobaron búsquedas, filtros combinados, meses sin datos, la suma por categoría y paginación con 101 movimientos; se eliminó la cuenta temporal. Pasan 105 Vitest con cobertura de dominio del 100 %, tipos, lint, build, 151 pgTAP y `db lint`. Quedan pendientes el reinicio local autorizado y comprobaciones adicionales de tooltips e interacción de filtros; sin commit.

2026-11-11 — En producción local se probó el formulario de filtros y su URL en otra pestaña. Con eventos de navegador simulados, ambos tooltips mostraron $1.284.500; ese mismo monto coincidió con el gasto del tablero. Se eliminó la segunda cuenta temporal y se confirmó que no quedan usuarios locales. Pendiente autorización para `db reset` y commit.

2026-11-11 — El dueño autorizó el reinicio local y el commit. `supabase db reset` aplicó todas las migraciones; pasaron nuevamente 151 pgTAP, 105 Vitest con cobertura de dominio del 100 %, tipos y lint. El build de producción pasó tras los cambios de interfaz. H7 terminado.
