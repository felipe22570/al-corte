# Paso 39 — Pago del saldo en dólares con pesos y cupo en USD

- **Hito PRD:** H11 (parte 4 de 4)
- **Estado:** ⬜ Pendiente
- **Inicio:**
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

- [ ] US$154 pagados con $510.000 → tasa 3.311,6883 y `amount_cop` = $510.000,00.
- [ ] US$153,26 pagados con $510.000 → tasa 3.327,6785 y `amount_cop` = $510.000,00, aceptado por la RPC; una compra con el mismo desfase sigue rechazada.
- [ ] Diferencia cambiaria con cargos en USD de distintas TRM y con un pago parcial.
- [ ] Equivalente del mes con pago total y con pago parcial.
- [ ] Cupo de la Mastercard con TRM $3.301,91 → $10.528.221,51; la Visa sigue en $6.154.225,14.
- [ ] Un pago en USD registrado con pesos no cambia el cupo más allá de los dólares pagados × TRM vigente.
- [ ] Sin TRM disponible, el cupo usa D3 y avisa que es estimado, en lugar de presentarlo en silencio.

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
