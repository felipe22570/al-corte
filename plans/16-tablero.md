# Paso 16 — Tablero

- **Hito PRD:** H7 (parte 1 de 2)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-11
- **Fin:** 2026-11-11
- **Commit:** ver historial de git (`feat: add dashboard with card summaries and monthly totals`)
- **Depende de:** 14, 15
- **Decisiones aplicables (decididas, ver README):** D2, D5

## Objetivo

Pantalla `/` (F6): estado de todas las tarjetas activas en una sola vista y los totales globales.

## Contenido

Por tarjeta (activas, no archivadas):

- Franja o chip `bg-card-N` junto al nombre, banco y `•••• 1234`.
- Próximo pago: total del extracto más próximo con `due_date ≥ hoy` y sin `paid_at` (`Money`), y su fecha límite con frase tipo "Pagas $1.284.500 el 2 dic". Estado con `dueTone` del paso 09: warning si faltan 5 días o menos ("Tu Visa vence en 3 días"), danger si está vencido, ok si ya está pagado.
- Cupo disponible y % de utilización con `UtilizationBar` (`rounded-full`): < 30% ok, 30–70% warning, > 70% o sobrecupo danger, siempre con el porcentaje en texto.
- Toda la tarjeta enlaza a `/tarjetas/[id]` (área táctil completa, foco visible).

Totales:

- **Deuda total pendiente:** Σ `used` de `card_balances` (o la definición que se fije en D2).
- **Total a pagar este mes:** Σ de extractos sin pagar con `due_date` dentro del mes calendario actual (Bogotá).
- **Gasto del mes actual frente al anterior:** `monthlySpending` + `compareMonths` (D5), con flecha y % en `text-muted-foreground` (gastar más o menos no es un estado de alerta; sin verde ni rojo).

Jerarquía visual: el **total a pagar este mes** es el monto protagonista (`text-amount-lg`); deuda total y gasto del mes van con `text-amount`. En el celular, la marca "Al Corte" puede ir como encabezado del tablero (decisión de diseño a anotar).

Botón flotante "Nuevo gasto" (ya existe del paso 10): único botón primary de la pantalla.

## Tareas

- [x] Funciones puras nuevas en `lib/domain/` con pruebas (mantener 100%): selección del "próximo pago" por tarjeta; total a pagar del mes; días hasta la fecha límite.
- [x] Consulta del tablero en el servidor sin N+1 por tarjeta, con paginación; no se agregó vista ni RPC.
- [x] `app/(app)/page.tsx` (Server Component) + `components/card-summary.tsx` + `components/dashboard-totals.tsx`.
- [x] Skeleton de carga reutilizado desde `app/(app)/loading.tsx`.
- [x] Estado vacío: sin tarjetas → "Aún no tienes tarjetas. Agrega la primera." con acción que lleva a `/ajustes`.

## Pruebas

- [x] Vitest: tono del próximo pago a 6, 5, 0 y −1 días (usa `dueTone` del paso 09);
- [x] Vitest: próximo pago con extractos pagados, sin pagar y vencidos; total del mes con dos extractos en el mismo mes y uno en el siguiente; días hasta la fecha límite cruzando fin de mes.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

Comprobaciones manuales con 2 tarjetas de prueba:

- [x] Cada tarjeta muestra el próximo pago y la fecha límite que coinciden con su página `/tarjetas/[id]` para extractos pendientes no vencidos; los vencidos se priorizan según la decisión aprobada.
- [x] Cupo disponible y utilización coinciden con `select * from card_balances`.
- [x] Registrar una compra a 6 cuotas desde el tablero → al volver, el próximo pago y el cupo se actualizan (flujo principal del PRD, paso 5).
- [x] Marcar un extracto como pagado → deja de contar en "Total a pagar este mes".
- [x] Gasto del mes frente al anterior coincide con un cálculo manual.
- [x] Rendimiento: alternativa aprobada por el dueño a Lighthouse: traza móvil de Chrome con Fast 4G y CPU 4× en producción local, LCP 1.432 ms. Ver notas para limitaciones.
- [x] 360 px y modo oscuro revisados en Chrome emulado.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add dashboard with card summaries and monthly totals`.

## Notas de progreso

<!-- Fecha — nota -->

2026-11-11 — El dueño aprobó el plan y priorizar el extracto no pagado de vencimiento más antiguo, incluso si está vencido. Sin dependencias ni migraciones previstas.

2026-11-11 — Implementada una primera versión del tablero y de las funciones de dominio. Pasan 96 Vitest con cobertura de dominio del 100 %, 151 pgTAP, tipos, lint y build. Quedan pendientes las comprobaciones con dos tarjetas locales, la medición Lighthouse, el reinicio local y revisar la paginación de las consultas para evitar totales incompletos ante el límite de filas de Supabase. No se han modificado datos reales ni creado un commit.

2026-11-11 — Se agregó paginación con orden estable y pruebas para evitar truncar resultados o presentar totales parciales ante errores. Pasan 98 Vitest con cobertura de dominio del 100 %, tipos, lint y build. La verificación con datos locales quedó bloqueada porque las conexiones a los puertos locales de Supabase devuelven `ECONNRESET`, aunque los contenedores figuran activos y Postgres responde dentro de su contenedor. La repetición de pgTAP desde el host también falló por esa conexión; los 151 pgTAP pasaron en la ejecución anterior. No se reinició ni borró la base. Siguen pendientes las comprobaciones visuales, Lighthouse y el reinicio local autorizado para el paso.

2026-11-11 — Con autorización se reiniciaron los contenedores locales de Supabase, sin borrar volúmenes; se restableció la conexión y pasaron de nuevo los 151 pgTAP. En Chrome emulado a 360 px y modo oscuro, con una cuenta temporal y dos tarjetas, se revisó el estado vacío y se registró una compra de $600.000 a seis cuotas: el tablero mostró $100.000 para el mes, $400.000 de cupo disponible y 60 % de utilización, coincidiendo con el detalle de la tarjeta. Tras marcar el extracto pagado, el total mensual bajó a $0 y se mostró el siguiente pago. La cuenta temporal se eliminó. Quedan pendientes la comparación de gasto entre meses, la revisión con movimientos en ambas tarjetas, Lighthouse y `db reset`; no hay commit.

2026-11-11 — Con otra cuenta temporal y movimientos en ambas tarjetas, el tablero mostró $300.000 este mes frente a $150.000 el anterior (↑ 100 %), y priorizó un extracto vencido de $150.000. Los cupos y porcentajes coincidieron con `card_balances`. En producción local, una traza de Chrome emulando 360 px, Fast 4G y CPU 4× registró LCP 1.432 ms y CLS 0; es una medición de DevTools, no de Lighthouse ni de producción remota. La cuenta temporal se eliminó. `db reset` sigue pendiente de autorización; Lighthouse no está instalado.

2026-11-11 — El dueño autorizó `db reset` local y aceptó la traza de Chrome como alternativa a Lighthouse. El reinicio aplicó todas las migraciones; pasaron 151 pgTAP, 98 Vitest con cobertura de dominio del 100 %, tipos, lint y `db lint`. El build de producción pasó y se usó para la traza. Se contrastó además el detalle de la segunda tarjeta con sus $200.000 y vencimiento del 25 nov; se eliminó la cuenta temporal usada. Sin dependencias ni migraciones nuevas.
