# Paso 32 — Pagos por tipo y abonos a capital

- **Hito PRD:** H10 (parte 6 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 27, 29, 30
- **Decisiones aplicables (decididas, ver README):** D4, D26, D31, D33, D37, D38, D48, D50

## Objetivo

Registrar cuánto se pagó de cada extracto y reflejar los abonos a capital como lo hace el banco (F14, R9).

## Contenido

- Migración:
    - `transactions.paid_statement_id` (extracto que cubre el pago; nulo en los demás tipos) y `transactions.payment_kind` (`minimum`, `total`, `other`). `statement_id` sigue siendo el de R1 por fecha, porque `statement_totals` y `card_balances` lo usan: un pago del 30 de noviembre al extracto del 15 de noviembre queda con `statement_id` de diciembre y `paid_statement_id` de noviembre.
    - `cards.payment_allocation_rule` (`bancolombia_priority`, `oldest_first`, `directed`) y `transactions.is_international`.
    - Tabla `principal_prepayments (payment_id, transaction_id, amount, effect, assumed)` con `user_id` y RLS. `assumed` marca la distribución hecha con el supuesto "más antigua" (R9).
    - Invariante nueva de cada compra: capital de cuotas + capital previo (D31) + abonos aplicados = valor. Las RPC de registro, edición y regeneración la validan.
    - Un pago en USD necesita `fx_rate` por la restricción de la tabla: se usa la TRM de D4 del día del pago, solo como referencia, hasta que la prioridad 4 de H11 registre la tasa real del banco.
- Registrar pago desde el extracto o el mes, por moneda: **mínimo**, **total** u **otro valor**, con fecha y monto. Crea un movimiento `payment` con `paid_statement_id` y la moneda. Los controles son botones secundarios con IDs únicos, sin copias completas de `StatementControls`.
    - Mínimo: marca pagado el saldo de esa moneda (D26 sigue disponible para marcar sin registrar valor).
    - Total: además liquida por anticipado las cuotas futuras de esa moneda; los meses siguientes dejan de proyectarlas y los intereses estimados bajan.
    - Otro valor: primero cubre el pago mínimo pendiente; el excedente es un abono a capital.
- Abono a capital, también registrable por separado:
    - Regla de aplicación por tarjeta (`payment_allocation_rule`): `bancolombia_priority` (tabla publicada por Bancolombia, por tipo y moneda), `oldest_first` (Davivienda, Falabella) o `directed` (el usuario elige la compra).
    - Efecto por abono: `reduce_term` (misma cuota, menos cuotas, última por el resto; por defecto en Bancolombia) o `reduce_installment` (mismo plazo, cuota recalculada). Ley 1555 de 2012 le da al deudor el derecho de elegir.
    - La app muestra la distribución propuesta compra por compra **antes de guardar**, y permite cambiarla. Las cuotas futuras afectadas se regeneran sin tocar las ya facturadas ni las previas (D31). El plan efectivo puede llegar a 72 cuotas (D50).
    - Pago total: cada compra de esa moneda recibe un abono por su capital pendiente y se eliminan sus cuotas futuras sin facturar; la invariante se mantiene con los abonos.
- Intereses estimados (R9): en `on_balance`, el abono reduce el capital desde su fecha y la estimación del periodo prorratea por días.
- Exportación: columnas y tabla nuevas en `lib/export-schema.ts`.
- Clasificación necesaria para la regla de Bancolombia: `transactions.is_international` (por defecto verdadero en USD) y tipos existentes (1 cuota, a cuotas con interés, sin interés, avance).

## Pruebas

- [ ] Prioridad en pesos: con una compra a 1 cuota sin facturar, una a cuotas nacional, una internacional, un avance y una al 0 %, el abono se reparte en ese orden.
- [ ] Prioridad en dólares: cuotas diferidas → avances → compras al 0 %.
- [ ] Dentro de un mismo nivel, la regla por defecto es la compra más antigua y queda marcada como supuesto (Bancolombia no publica ese orden).
- [ ] Reducir plazo: avance de $600.000 a 24 cuotas con abono que deja $269.998,46 → 18 cuotas efectivas, igual que el extracto real.
- [ ] Reducir cuota: mismo número de cuotas y nueva cuota = saldo ÷ cuotas restantes.
- [ ] Pago total: ningún mes futuro proyecta cuotas de esa moneda.
- [ ] Un pago en COP nunca se aplica al saldo en USD.
- [ ] Un pago hecho después del corte marca el extracto que cubre (`paid_statement_id`) y no cambia el total de ese extracto.
- [ ] La invariante de capital se cumple tras abonos, pago total y edición de la compra.
- [ ] Estimación prorrateada: un abono a mitad del periodo reduce el interés estimado en la proporción de días.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

## Criterios de terminado

- Commit: `feat: add typed payments and principal prepayments`.

## Notas de progreso

<!-- Fecha — nota -->
