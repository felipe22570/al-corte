# Paso 32 — Pagos por tipo y abonos a capital

- **Hito PRD:** H10 (parte 6 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-19
- **Fin:** 2026-11-19
- **Commit:** `feat: add typed payments and principal prepayments` (ver historial de git)
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

- [x] Prioridad en pesos: con una compra a 1 cuota sin facturar, una a cuotas nacional, una internacional, un avance y una al 0 %, el abono se reparte en ese orden.
- [x] Prioridad en dólares: cuotas diferidas → avances → compras al 0 %.
- [x] Dentro de un mismo nivel, la regla por defecto es la compra más antigua y queda marcada como supuesto (Bancolombia no publica ese orden).
- [x] Reducir plazo: avance de $600.000 a 24 cuotas con abono que deja $269.998,46 → 18 cuotas efectivas, igual que el extracto real.
- [x] Reducir cuota: mismo número de cuotas y nueva cuota = saldo ÷ cuotas restantes.
- [x] Pago total: ningún mes futuro proyecta cuotas de esa moneda.
- [x] Un pago en COP nunca se aplica al saldo en USD.
- [x] Un pago hecho después del corte marca el extracto que cubre (`paid_statement_id`) y no cambia el total de ese extracto.
- [x] La invariante de capital se cumple tras abonos, pago total y edición de la compra.
- [x] Estimación prorrateada: un abono a mitad del periodo reduce el interés estimado en la proporción de días.

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

- 2026-11-19 — Decisiones del dueño antes de implementar (registradas en el README):
    - Una compra con abonos solo permite cambiar categoría, comercio y nota. Borrar un pago restaura exactamente las cuotas que reemplazó, y solo si es el abono más reciente de cada compra (LIFO).
    - Un abono a una compra de una cuota sin facturar baja ese cargo en su extracto: pago mínimo, desglose y categoría.
- 2026-11-19 — Implementado:
    - Migración `20261119020000_payments_prepayments.sql`:
        - `cards.payment_allocation_rule`.
        - `transactions.paid_statement_id` (FK compuesta con dueño y tarjeta), `payment_kind` e `is_international`. Un trigger da el valor por defecto: verdadero en compras y avances en USD.
        - Tabla `principal_prepayments` con `amount_cop`, `effect`, `assumed`, `replaced_from_number` y `replaced_installments` (copia de las cuotas reemplazadas), con RLS.
        - Trigger que deshace un abono al borrarlo (LIFO) y RPC `register_payment` (pago, abonos, cuotas rehechas y marca de pago en una transacción; valida la invariante en la moneda y en COP).
        - RPC `update_transaction_details`. Las RPC de registro y edición ahora leen `is_international`, y la de edición rechaza movimientos con abonos o pagos con tipo.
        - Vista `statement_currency_totals`: resta abonos a cargos de una cuota y suma a la deuda de un corte los abonos posteriores a él.
    - Dominio `lib/domain/payments.ts`:
        - Pago mínimo pendiente y reparto del pago.
        - Niveles de Bancolombia en COP y USD, propuesta (`bancolombia_priority`, `oldest_first`, `directed`) y validación de la distribución editada.
        - `reduce_term` y `reduce_installment` en capital fijo y cuota fija.
        - Pago total, payload de la RPC y peso por días de un abono en la estimación de intereses (`interest.ts` acepta `weight`; `months.ts` recibe `prepaymentBases`).
    - Lecturas: `lib/queries/payments.ts` (contexto del pago) y `lib/queries/prepayments.ts` (cargos netos y bases de interés). Extracto, tarjeta y meses las usan.
    - Interfaz:
        - "Registrar pago" (`StatementPaymentForm`) en cada moneda del extracto y del mes, solo en extractos cortados. Muestra mínimo, total u otro valor, fecha, cobertura del mínimo, abono, efecto y distribución editable con su efecto por compra y el supuesto marcado.
        - "Pagos registrados a este extracto" en el extracto. Abonos en el detalle del movimiento y "Cubre el extracto" en el del pago.
        - Formulario limitado de edición, aviso al borrar un pago con abonos, "Abonos a capital" en la tarjeta y casilla "Compra/Avance internacional".
    - Exportación: columnas nuevas y tabla `principal_prepayments`. El CSV serializa la columna JSON.
- Verificación:
    - 463 pruebas de Vitest con cobertura de dominio al 100 %, 295 de pgTAP (47 nuevas), integración local de meses y de pagos (`payments-local.integration.test.ts`: payload de TypeScript contra la RPC real, LIFO y restauración), `db reset`, tipos regenerados y build en verde.
    - Manual contra Supabase local (usuario temporal, borrado) en el Chrome del MCP a 360 px, en claro y oscuro:
        - Otro valor de $600.000 al extracto del 15 de noviembre. Propone: Mercado (una cuota) $50.000, Nevera $400.000 y el avance $4.631,68. Lo edité a $250.000 y $154.631,68, con aviso de suma mientras faltaba.
        - Al guardar quedó marcado el saldo en pesos. Diciembre muestra la compra en $0, las cuotas rehechas e intereses prorrateados. El avance queda en "11 de 18 cuotas".
        - El pago total en dólares liquidó la compra en USD: enero solo conserva US$ 0,21 de intereses prorrateados.
        - El borrado desde la interfaz no se probó a mano; lo cubren pgTAP y la integración.
- Decisiones menores (para revisión del dueño):
    - Facturadas son las cuotas con corte anterior a la fecha del pago. Desde la primera sin facturar se rehace el plan en los mismos extractos. Reducir plazo nunca alarga el plan: si el redondeo pediría una cuota más, la última absorbe la diferencia.
    - `installments_count` conserva el plan registrado. El plan vigente son las filas de `installments`, que ya usa "Cuota k de N". Así una compra liquidada no pasa a contarse como compra de una cuota.
    - El pago mínimo pendiente usa el mínimo del banco si está registrado (el banco aplica el pago a su cifra) y descuenta los pagos ya registrados para ese extracto y moneda. "Mínimo" y "Total" se redondean hacia arriba a la unidad, como el banco. Un excedente de hasta 1 peso o 1 dólar no es abono.
    - Solo se registran pagos de extractos cortados, con fecha posterior al corte y hasta hoy. "Total" exige que no haya pasado el siguiente corte; si pasó, se usa "Otro valor". "Otro valor" marca la moneda como pagada solo si cubre el mínimo pendiente; una marca existente conserva su fecha. Borrar un pago no quita la marca (D26).
    - "Total" liquida las compras y avances a cuotas de la deuda del extracto (los de su corte o anteriores), no los del periodo abierto. Si el abono supera todos los saldos, el resto es saldo a favor.
    - Clasificación de Bancolombia: compras internacionales en pesos en su nivel (12) aunque sean de una cuota, comisiones de avance en "comisiones", ajustes en "ajustes de una cuota". En dólares, las compras de una cuota van con las cuotas diferidas. "Supuesto" solo marca los abonos del nivel donde se acaba el dinero si hay varias compras en él. Una distribución editada nunca es supuesto.
    - En `directed` la app no propone nada y el dueño reparte. Un pago en USD guarda como referencia la TRM de D4 del día; sin TRM no se puede registrar.
    - Los intereses estimados prorratean el abono por días desde el inicio del periodo hasta la fecha del pago, incluido el de una compra liquidada en ese periodo.
    - En el extracto, la cifra del mínimo se muestra redondeada ($145.368) y el pago mínimo ofrecido es la cifra hacia arriba ($145.369). Es intencional (redondeo del banco), pero puede llamar la atención.
