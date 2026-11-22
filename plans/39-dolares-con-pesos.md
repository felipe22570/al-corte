# Paso 39 — Pago del saldo en dólares con pesos y cupo en USD

- **Hito PRD:** H11 (parte 4 de 4)
- **Estado:** 🟡 En progreso
- **Inicio:** 2026-11-22
- **Fin:**
- **Commit:**
- **Depende de:** 35, 38 (TRM diaria, D57)
- **Decisiones aplicables (decididas, ver README):** D2, D3, D4, D33, D37, D52, D56, D57

## Objetivo

Registrar el costo real en pesos de pagar el saldo en dólares (F23) y valorar la deuda en dólares del cupo como lo hace el banco (D52).

## Contenido

- Pago en USD (`components/statement-payment-form.tsx`, `lib/domain/payments.ts`, `lib/actions/payments.ts`):
    - hoy el formulario no pide TRM: `paymentPayload` usa la última conocida (D4) para el equivalente en pesos;
    - opción "Pagué con pesos": se ingresa el valor en pesos debitado y la app deriva la tasa (pesos ÷ dólares, 4 decimales) en lugar de usar la de D4;
    - se guarda el valor exacto en pesos como `amount_cop` del pago. La RPC de pagos exige hoy `amount_cop = round(amount × fx_rate, 2)`, que con una tasa de 4 decimales puede fallar por un centavo (US$153,26 con $510.000 → tasa 3.327,6785 → $510.000,01). Migración: solo para movimientos `payment` en USD se acepta `|amount_cop − amount × fx_rate| ≤ amount × 0,00005`, el error máximo de redondear la tasa a 4 decimales. Las compras y las demás validaciones no cambian. Los abonos a capital (`principal_prepayments`) siguen usando la TRM de cada compra.
- Diferencia cambiaria en el extracto (R11), por ejemplo: "Pagaste $510.000 por US$154; con la TRM de cada compra eran $489.000: el dólar te costó $21.000 más". Con signo neutro si costó menos.
- Mes de pago: el equivalente COP del saldo en dólares usa los pesos pagados por la parte pagada y el equivalente de referencia por la que falta: pesos pagados + (USD pendiente × equivalente de referencia). Un pago parcial no cambia el criterio del resto.
- Cupo (D52):
    - `card_balances` (migración) separa monedas: usado = neto en COP + neto en USD × TRM vigente más reciente de `fx_rates`.
    - Neto en USD = cargos en USD − pagos en USD − devoluciones en USD − capital previo en USD (`before_tracking`) + intereses facturados en USD, todo en dólares. Así, un pago en dólares hecho con pesos no mueve el cupo por la diferencia cambiaria.
    - Sin TRM en `fx_rates`, el cupo usa la TRM de cada compra (D3) y lo avisa ("Cupo estimado con la TRM de cada compra"), sin presentarlo como el del banco.
    - En la verificación contra un extracto (cierre mensual e importación), la TRM de `trmForStatement` (último día hábil antes del corte, paso 38).
    - Mostrar la TRM usada junto al cupo.

## Pruebas

- [x] US$154 pagados con $510.000 → tasa 3.311,6883 y `amount_cop` = $510.000,00.
- [x] US$153,26 pagados con $510.000 → tasa 3.327,6785 y `amount_cop` = $510.000,00, aceptado por la RPC; una compra con el mismo desfase sigue rechazada.
- [x] Diferencia cambiaria con cargos en USD de distintas TRM y con un pago parcial.
- [x] Equivalente del mes con pago total y con pago parcial.
- [x] Cupo de la Mastercard con TRM $3.301,91 → $10.528.221,51; la Visa sigue en $6.154.225,14.
- [x] Un pago en USD registrado con pesos no cambia el cupo más allá de los dólares pagados × TRM vigente.
- [x] Sin TRM disponible, el cupo usa D3 y avisa que es estimado, en lugar de presentarlo en silencio.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build && pnpm start
```

- [ ] Registrar el próximo pago real del saldo en dólares con los pesos debitados y revisar extracto, mes y cupo.
- [ ] Con el extracto de diciembre (corte el martes 15): confirmar que la TRM de `trmForStatement` cuadra el cupo del banco. Si no cuadra, anotar la diferencia y revisar D52 con el dueño antes de cerrar.
- [ ] Al cerrar el paso, H11 queda marcado como cerrado en `plans/README.md`.

## Criterios de terminado

- Commit: `feat: record USD payments in pesos and value USD debt at current TRM`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-22 — Implementado. Migración `20261122030000_usd_payments_and_credit.sql`:
    - `transactions.cop_debited` (solo pagos en USD).
    - `register_payment` con la tolerancia de la tasa redondeada solo cuando hay pesos debitados.
    - `card_balances` por moneda: agrega `cop_used`, `usd_net`, `fx_rate` y `fx_estimated` al final; los dólares a la TRM más reciente, o con la de cada movimiento y la marca si no hay TRM.
    - `import_statement_file` devuelve las partes del cupo.
- Dominio: `lib/domain/fx-difference.ts` (`rateFromPesos`, `exchangeDifference`, `paidUsdEquivalent`, `availableCredit`), `paymentPayload` con `copDebited`, y `projectStatements` con `usdPaidWithPesos` por extracto. Interfaz: "Pagué con pesos" con la tasa del banco a la vista, diferencia cambiaria en el extracto (`ExchangeDifference`), "Pagado en pesos", nota de la TRM junto al cupo (detalle de tarjeta y franja de meses) y verificación de la importación con `trmForStatement`.
- Decisiones del dueño al aprobar el plan: solo los pagos marcados con pesos cuentan como pesos pagados; un pago mayor que los dólares del extracto aporta al mes su parte proporcional; la TRM del corte se usa en la importación y el cierre no gana campo de cupo. Menores: la TRM se muestra con 4 decimales, como en el detalle del movimiento; la nota del cupo solo aparece con deuda en dólares; una diferencia de menos de medio peso se dice "lo mismo".
- Pruebas: pgTAP 200 (tolerancia, compra con el mismo desfase rechazada, cupo a la TRM vigente, pago con pesos que solo libera los dólares pagados, sin TRM estimado y marcado) y 040 ajustada a D52 con su propia TRM. Vitest: dominio (5 nuevas, más pagos y meses), acciones de pago con pesos, presentación y formulario en jsdom. Total: 593 de Vitest; cobertura de dominio 100 %.
- Con los datos reales de la base local, en solo lectura: con la TRM de $3.301,91 el cupo de la Mastercard da $10.528.221,51 y el de la Visa $6.154.225,14. La vista previa del archivo de noviembre da exactamente esos cupos, con la TRM del corte calculada por `trmForStatement`.
- Revisión en navegador (local, 360 px): cupo de la Mastercard en oscuro ("Dólares con la TRM de 3.461,9200") y formulario de pago en dólares en claro ($31.000 por US$9: tasa 3.444,4444), sin guardar.
- Durante la revisión, un `pnpm build` quedó sin `.next` completo, probablemente porque el servidor de desarrollo del puerto 3000 comparte esa carpeta. Repetir el build lo resolvió.
- Pendiente del dueño: registrar el próximo pago real en dólares con los pesos debitados, comprobar el cupo con el extracto de diciembre y cerrar H11 junto con los pendientes de los pasos 36 y 38 (incluido `supabase db reset`).
- 2026-11-22 — `supabase db reset` local con autorización del dueño. Antes se guardó un respaldo de los datos en `private/` (fuera de git). Sobre la base limpia pasan todas las pruebas pgTAP (incluidas 070, 130 y 140) y las de integración local (39). Luego se restauraron los datos: usuario local, script del paso 35 y TRM local. Los conteos y la suma de `amount_cop` coinciden con el respaldo (84 movimientos, 1.565 cuotas, 74 extractos, 6 suscripciones, 6 saldos de extracto). El código de los pasos 36 a 39 se publicó en Vercel con el push de `6573efb`, después de cambiar a dígitos ficticios la tarjeta de la prueba pgTAP 200. Quedan pendientes el próximo pago real en dólares y el extracto de diciembre, que aún no existen.
