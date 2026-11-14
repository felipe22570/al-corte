# Paso 21 — Dominio: meses de pago y proyección (R7)

- **Hito PRD:** H9 (parte 1 de 6)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 06, 14, 15, 16
- **Decisiones aplicables (decididas, ver README):** D1, D2, D4, D5, D10, D16, D18–D29

## Objetivo

Toda la lógica de la vista por meses como funciones puras en `lib/domain/months.ts`, con cobertura del 100 %, antes de tocar la interfaz. Ninguna pantalla debe calcular meses por su cuenta.

## Contenido

Funciones sugeridas (los nombres pueden cambiar si el plan lo justifica):

- `paymentMonth(dueDate)`: mes `AAAA-MM` de una fecha límite (D18). Reutiliza `monthKey` de `dates.ts`.
- `projectSubscriptionCharges(subscription, from, to)`: reutiliza `chargeDatesBetween` desde hoy inclusive (R4), respetando estado, prueba gratis, inicio, frecuencia y día 31. No proyecta suscripciones de tarjetas archivadas ni reconstruye cobros históricos.
- `projectStatements({ cards, statements, movements, installments, subscriptions, fxRate, today, horizon })`: combina extractos reales y virtuales tanto para el mes actual abierto como para los futuros. Deduplica cobros por `(subscription_id, date)` y usa importe, TRM y asignación del real cuando existe. Respeta las fechas guardadas de extractos existentes (D10); agrega manejo solo a virtuales de tarjetas activas (D1, D24). Los importes reales no se recalculan con la TRM o las condiciones actuales.
- `buildMonths({ statements, today })`: agrupa por mes de pago y devuelve `month`, `kind` (`past`, `current`, `future`), `status` (D19; sin estado financiero si el actual está vacío), total COP conocido, `pendingConfirmation` de extractos reales sin `paid_at` (D26), `billed`, `openRecorded`, `projected`, cobros USD sin convertir y completitud. Incluye detalle por tarjeta y extracto con fechas, estado y origen real/virtual. El total del actual es `billed + openRecorded + projected`, no reemplazado por `real_total` (D27).
- `futureHorizon(...)`: considera extractos reales, cuotas, suscripciones elegibles y manejo dentro de los siguientes 12 meses de pago. Manejo por sí solo puede extenderlo hasta actual + 12. Conserva reales en cero o negativo y cobros sin TRM; omite meses sin datos ni compromisos. Devuelve también si hay cuotas o extractos reales posteriores para el aviso de límite (D21).
- `overdueStatements(...)`: extractos reales vencidos de meses anteriores, importe calculado sin descontar abonos y agrupación con acceso a todos los meses afectados (D23, D26).
- `monthBreakdown(...)`: conceptos de R5 con ajustes, devoluciones restadas y pagos aparte. Por categoría distribuye los mismos importes del mes de pago: `total_cop` de cuotas con categoría de la compra original, cargos y proyecciones con su categoría o "Sin categoría". No duplica compra completa ni intereses (D28).
- `monthComparison(...)`: determina si hay dos meses de pago comparables (cerrados, con datos, sin proyección ni TRM faltante), sin confundir ausencia de datos con cero. Devuelve condición o diferencia para presentar texto neutro (D29).

Reutilizar `statementItemsFromMovements`, `statementTotals`, `statementPeriod`, `dueDateFor`, `chargeDatesBetween` y `monthlySpending` (solo para "Compraste en este mes", D5). `compareMonths` calcula diferencias y controla base cero; las protecciones de bases pequeñas/negativas y porcentajes extremos están en `lib/format.ts`, no en `compareMonths`. No reutilizar `spendingByCategory` para el mes de pago: aplica D5, no R7.

## Tareas

- [ ] `lib/domain/months.ts` con las funciones de arriba y tipos exportados.
- [ ] Pruebas en `lib/domain/__tests__/months.test.ts`.
- [ ] Tipos explícitos para identidad y origen de cada cargo, extracto real/virtual, importes conocidos, cobros sin TRM y elegibilidad de comparación. No representar un importe USD desconocido en COP como cero.
- [ ] No duplicar lógica de calendario ni crear un segundo algoritmo de recurrencias: contrastar las proyecciones con los casos del cron existente.
- [ ] Definir límites por mes de pago y después asignar las fechas de cobro por R1; no confundir 12 meses de cobro con 12 meses de pago.
- [ ] Si alguna función existente del tablero (`lib/domain/dashboard.ts`) queda duplicada, documentarlo en las notas; se retira en el paso 25, no aquí.

## Pruebas

- [ ] Mes de pago: corte 31 y pago 5 → el extracto de octubre pertenece a noviembre; corte 15 y pago 2 → igual. Fecha límite el último día del mes.
- [ ] Estados: todos los extractos marcados (Pagado), algunos marcados (Pendiente), un extracto vencido (Vencido y precedencia), mes futuro (Estimado), pasado vacío (excluido) y actual vacío (presente, sin badge Pagado). Tener solo previstos no significa Pagado.
- [ ] Confirmación: extracto de $500.000 y abono de $200.000 → pendiente de confirmar $500.000 mientras no tenga `paid_at`; marcarlo reduce ese indicador, no el total calculado ni genera pagos. El pendiente excluye proyecciones y `real_total` no altera los totales.
- [ ] Mes actual: cerrado más abierto más suscripción pendiente (hoy 13, cobro 20, corte 25, pago 28); `total = billed + openRecorded + projected`. Incluir manejo de un extracto virtual que se paga este mes.
- [ ] Proyección: mensual día 31 en febrero normal y bisiesto; anual dentro del rango; pausada; cancelada; tarjeta archivada; prueba que termina dentro del rango y cobro en `trial_ends_at`; USD con TRM de D4 y sin ella (importe desconocido, total conocido incompleto).
- [ ] Dedupe: cobro de hoy ya generado; mismo ID de suscripción y fecha proyectado/real una sola vez; distintas suscripciones el mismo día sí cuentan; al pasar previsto a real con igual importe el total se mantiene; con otro importe/TRM solo cambia la diferencia.
- [ ] Cuota de manejo: se proyecta solo en virtuales, no se duplica en reales, no se proyecta en archivadas ni cambia retroactivamente un cargo real.
- [ ] Rango: compra a 24 cuotas → 12 meses futuros y aviso de compromisos posteriores; suscripción o manejo sin compras extienden la ventana; sin extractos, cuotas, suscripciones elegibles ni manejo → ningún mes futuro. Cruce diciembre/enero y cobro que se paga fuera de la ventana.
- [ ] Vencidos de meses anteriores: cuentan en su mes y aparecen en `overdueStatements`, no en el total del mes actual.
- [ ] Desglose: suma por conceptos = suma por categorías = total conocido, con ajustes, sin categoría y devoluciones. Compra de $1.200.000 a 12 cuotas sin intereses → $100.000 en cada mes de pago, no $1.200.000; cuotas con interés lo incluyen una sola vez.
- [ ] Extractos reales con fechas antiguas tras cambiar corte/pago; varias filas de extracto de una tarjeta en el mismo mes; todos los datos de tarjetas archivadas se conservan.
- [ ] Cero y negativos: reales en cero se conservan; devoluciones superiores a cargos conservan signos y la igualdad de desgloses.
- [ ] Comparación: actual abierto, futuro, TRM faltante y mes anterior sin datos no generan porcentaje; dos meses cerrados comparables sí; bases cero, pequeñas, negativas y porcentajes extremos tienen salida segura.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
```

- [ ] Cobertura de `lib/domain/` sigue en 100 %.
- [ ] Con fixtures locales/sintéticos de QA Visa y QA Mastercard, anotar los meses que produce `buildMonths` y contrastarlos a mano con los extractos y los cargos previstos por separado. No escribir datos de prueba en producción.

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- Commit: `feat: add payment-month grouping and projection domain`.

## Notas de progreso

<!-- Fecha — nota -->
