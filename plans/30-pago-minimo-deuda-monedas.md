# Paso 30 — Pago mínimo, deuda total y saldos por moneda

- **Hito PRD:** H10 (parte 4 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-17
- **Fin:** 2026-11-17
- **Commit:** `feat: show minimum payment and total debt per currency` (ver historial de git)
- **Depende de:** 27, 29
- **Decisiones aplicables (decididas, ver README):** D3, D26, D27, D29, D33, D48

## Objetivo

Mostrar por extracto y moneda cuánto se paga este mes y cuánto se debe en total, con el saldo en dólares por separado (F12, R8).

## Contenido

- Migración:
    - Tabla `statement_balances (statement_id, currency, real_minimum, real_total, paid_at)` con `user_id`, RLS y único por `(statement_id, currency)`. Migrar `statements.real_total` y `paid_at` existentes a la fila COP, conservando el comportamiento de D26.
    - En la misma migración se eliminan `statements.real_total` y `statements.paid_at`: una sola fuente para las marcas de pago. Unos 30 archivos los leen hoy (`lib/domain/months.ts`, `lib/queries/`, `lib/actions/statements.ts`, páginas de tarjeta y extracto, componentes de mes y sus pruebas); el plan del paso los lista y los migra.
    - `statement_totals` por moneda (una fila por extracto y moneda, con `amount` en la moneda original) o una vista nueva equivalente. La usan las páginas de tarjeta y de extracto.
- Dominio: pago mínimo y deuda total por extracto y moneda según R8. Estado del extracto: pagado cuando todas las monedas con cargos están marcadas.
- Detalle de extracto: dos bloques por moneda (pago mínimo y deuda total), con el valor del banco como referencia y la diferencia solo si supera el redondeo del banco. Marcar pagado por moneda, con controles secundarios e IDs únicos, sin copiar `StatementControls` completo por moneda.
- Meses (`months.ts` y vistas): el total del mes es el pago mínimo en COP; los cargos en USD se muestran aparte ("y US$ 9"), con su equivalente COP solo como referencia. Deuda total como dato secundario. Actualizar R7 en el código donde hoy suma `total_cop` de cuotas en USD.
- TRM faltante (R8): ya no deja incompleto el total en pesos ni el de dólares; solo falta el equivalente COP de referencia, con su aviso. Ajustar `complete`, "Total conocido" y las condiciones de comparación (D29) en `months.ts`, y la prueba correspondiente de `AGENTS.md`.
- Cupo (`card_balances`): se mantiene en COP, como lo muestra el banco, con el capital USD por su equivalente.
- Exportación: `statement_balances` en `lib/export-schema.ts`; quitar las columnas eliminadas.

## Pruebas

- [ ] Con los datos de noviembre (JSON de importación como fixture, sin datos personales): Visa $1.178.835,57 y $3.845.774,86; Mastercard $1.706.233,98 y $4.265.727,76; USD 8,22 y 153,26. Coinciden con el banco tras su redondeo hacia arriba.
- [x] Marcar pagado el saldo en COP no marca el de USD.
- [x] Un mes con cargos solo en USD no muestra "$0" como total a pagar.
- [x] Sin TRM, el total en dólares se conserva y solo falta el equivalente COP, con su aviso.
- [x] Ningún archivo lee `statements.paid_at` ni `statements.real_total` (búsqueda en el código y `supabase test db`).

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [x] 360 px y modo oscuro en extracto y mes.

## Criterios de terminado

- Commit: `feat: show minimum payment and total debt per currency`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-17 — Implementado:
    - Migración `20261117030000_statement_balances.sql`: tabla `statement_balances` con RLS, migración de marcas y eliminación de `statements.real_total` y `statements.paid_at`. Vista `statement_currency_totals` con conceptos en moneda original, `total_calculated` (pago mínimo antes de la estimación de intereses), `pending_principal`, `total_debt`, `total_cop` de referencia y `has_charges`. Reemplaza a `statement_totals`, que se elimina.
    - Dominio: `lib/domain/balances.ts` (`bankDifference`, `statementPaidAt`); `months.ts` separa pesos y dólares (`recordedUsd`, `projectedUsd`, `usdEquivalentCop`, `debt`, `paidByCurrency`, `totalUsd`, `pendingConfirmationUsd`, `monthBreakdown(…, "USD")`, vencidos y comparación por moneda).
    - Lecturas: `lib/queries/statement-balances.ts` (tarjeta y extracto) y `supabase-months.ts` (marcas por moneda y capital pendiente).
    - Interfaz: bloques "En pesos" y "En dólares" en el extracto, con pago mínimo, deuda total, equivalente de referencia y valores del banco con diferencia fuera del redondeo. `StatementBalanceControls` reemplaza a `StatementControls`. Pago marcado por moneda en el mes, y `CurrencyAmounts` y `CurrencyInline` ("$X y US$ Y") en meses, tarjeta y alertas.
- Verificación:
    - 405 pruebas de Vitest con cobertura de dominio al 100 %, 223 de pgTAP, integración local de meses y build en verde.
    - Manual contra Supabase local con usuario temporal (borrado), en un Chrome headless propio a 360 px en claro y oscuro: el perfil del MCP de chrome-devtools estaba bloqueado por otra sesión.
        - Diciembre muestra $100.000 y US$ 13,22, la deuda total ($400.000 y US$ 18,22) y el equivalente de los dólares ($52.880).
        - El extracto solo en dólares encabeza con US$ 8,22 y sin bloque en pesos.
        - Al marcar pesos, el pendiente queda en US$ 13,22 y el extracto sigue "Pendiente".
        - Sin desbordes.
- Decisiones menores (para revisión del dueño):
    - Migración de marcas: `real_total` va a la fila COP. Un extracto ya marcado pagado también marca su fila USD si tiene cargos en dólares, para no cambiarle el estado (D26).
    - Un extracto queda pagado cuando todas sus monedas con cargos están marcadas; sin cargos, decide la marca en pesos. Una fila USD con solo capital pendiente (sin cargos en el extracto) no bloquea el pagado.
    - La deuda total cuenta el capital de cuotas posteriores al corte de compras y avances cuyo extracto es igual o anterior a ese corte. La estimación de intereses sobre saldo se suma al pago mínimo y a la deuda total de su moneda.
    - Diferencia con el banco: se oculta si 0 ≤ banco − cálculo ≤ 1 (redondeo hacia arriba del banco). Se muestra si el banco cobra menos o más de una unidad por encima.
    - Meses: "Ya facturado" y "Aún puede crecer" siguen en pesos; los dólares van en el total y en "Cargos en dólares por concepto". El gráfico por categoría es solo de pesos y su título lo indica cuando hay dólares. La comparación en pesos se acompaña de la diferencia en dólares si alguno de los dos meses tiene dólares, y la falta de TRM ya no la bloquea.
    - Sin TRM desaparece "Total conocido" y el aviso pasa a "Falta la TRM" (solo para el equivalente en pesos).
    - El extracto encabeza con "Pago mínimo". Con dos monedas, los controles de pago del mes dicen "… en pesos" o "… en dólares".
- Pendiente: la prueba con los extractos de noviembre (Visa $1.178.835,57 y $3.845.774,86; Mastercard $1.706.233,98 y $4.265.727,76; USD 8,22 y 153,26) necesita el JSON de importación del paso 35, que no está en el repositorio. Se hará en ese paso.
- Nota: había un `next-server` ajeno escuchando en el puerto 3000 (pid 719490); no se tocó y la verificación usó el 3100.
