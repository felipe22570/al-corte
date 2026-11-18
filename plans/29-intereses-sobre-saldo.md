# Paso 29 — Intereses sobre saldo

- **Hito PRD:** H10 (parte 3 de 9)
- **Estado:** ✅ Terminado
- **Inicio:** 2026-11-17
- **Fin:** 2026-11-17
- **Commit:** `feat: add on-balance interest mode with estimates` (ver historial de git)
- **Depende de:** 27
- **Decisiones aplicables (decididas, ver README):** D27, D32, D48

## Objetivo

Que las tarjetas que cobran intereses sobre saldo (Bancolombia, Davivienda, BBVA) se calculen como en el banco (F11, R8).

## Contenido

- Migración: `cards.interest_mode` (`per_installment` por defecto, `on_balance`). Solo se puede cambiar mientras la tarjeta no tenga compras a varias cuotas: lo hace cumplir un trigger en la base, no solo la interfaz, que explica por qué está bloqueado.
- En `on_balance`, el registro de compras genera cuotas solo de capital (interés 0). La RPC de registro rechaza cuotas con interés en tarjetas `on_balance`, aunque el cliente las envíe.
- Intereses del extracto: si existe un cargo `interest` real, se usa ese. Si no, `lib/domain` calcula una estimación no guardada (R8) y la vista la etiqueta "Intereses estimados".
- Registrar los intereses reales desde el detalle del extracto con un formulario corto (valor y moneda).
- Proyección de meses (`months.ts`): extractos reales sin interés registrado y extractos virtuales usan la estimación sobre el capital pendiente proyectado.
- Ajustes de tarjeta: selector del modo con una ayuda breve ("Bancolombia cobra intereses sobre el saldo en una sola línea").
- Exportación: `cards.interest_mode` en `lib/export-schema.ts`.
- La estimación es en centavos (D48) y, para compras en USD, en dólares. El prorrateo por días tras un abono (R9) llega en el paso 32.

## Pruebas

- [x] Estimación con compras con interés, sin interés, a una cuota y avances, con tasas distintas por compra.
- [x] El interés real reemplaza al estimado sin duplicarlo en el total del mes.
- [x] Una tarjeta `per_installment` no cambia su comportamiento.
- [x] La RPC rechaza una cuota con interés en una tarjeta `on_balance`; el trigger impide cambiar el modo con compras a varias cuotas.
- [ ] Contraste con noviembre: la estimación queda en el orden de magnitud de los intereses reales ($29.457,05 Visa, $38.172,61 Mastercard); anotar la diferencia en las notas, sin forzar el cálculo para que coincida.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
pnpm build
```

## Criterios de terminado

- Commit: `feat: add on-balance interest mode with estimates`.

## Notas de progreso

<!-- Fecha — nota -->

- 2026-11-17 — Implementado:
    - Migración `20261117020000_interest_mode.sql`: enum y `cards.interest_mode`, trigger `cards_interest_mode_locked` y RPC que rechaza cuotas con interés en `on_balance`.
    - Dominio: `lib/domain/interest.ts` (`estimateBalanceInterest`); cuotas solo de capital con `interestMode` en `installments.ts` y `transaction-plan.ts`; estimación en `projectStatements` y `estimatedInterest` en `monthBreakdown`.
    - Lecturas: `lib/queries/interest-estimates.ts` para el detalle de tarjeta y el extracto.
    - Interfaz: formulario "Intereses reales" en el extracto (`recordStatementInterest`), selector "Cobro de intereses" en Ajustes, aviso en la vista previa del gasto y la etiqueta "Intereses (incluye estimados)" en el detalle del mes.
    - Exportación: `cards.interest_mode`.
- Verificación:
    - 389 pruebas de Vitest con cobertura de dominio al 100 %, 208 de pgTAP, build en verde e integración local de meses en verde.
    - Manual contra Supabase local con un usuario temporal, borrado al terminar:
        - El IKEA en curso en una Visa `on_balance` deja la cuota 3 solo de capital. El extracto del 15 de noviembre suma $147.809: $112.965 de cuota, $30.000 de manejo y $4.844 de intereses estimados. El mes de diciembre cuadra con ese total y muestra "Intereses (incluye estimados)".
        - Al registrar $29.457,05 de intereses reales, el total pasa a $172.422 y la estimación desaparece.
        - Ajustes bloquea el modo en la tarjeta con compras a cuotas y lo explica.
        - Revisado a 360 px en modo claro y oscuro.
- Decisiones menores (para revisión del dueño):
    - Capital pendiente al inicio del periodo = saldo después del extracto anterior, es decir, antes de la cuota facturada en este extracto (mismo criterio que la deuda total de D33). Las compras hechas durante el periodo no generan interés estimado en su primer extracto. Es una aproximación y el dato real del cierre mensual (paso 33) la corrige.
    - La estimación se redondea a centavos por compra. En USD se calcula en dólares y se suma al total con el equivalente COP de la TRM de la compra (hasta el paso 30, cuando los totales se separan por moneda).
    - La estimación forma parte del total calculado del extracto real (cargo `interest` con `estimated: true`), no de los "cobros previstos". Así el pendiente de confirmar pago y los estados funcionan igual que con un extracto normal. Los extractos virtuales no tienen cuotas en este paso, así que no llevan estimación (las suscripciones diferidas del paso 31 la incorporarán).
    - El interés real se registra como un cargo `interest` con fecha de corte, desde el extracto y solo en tarjetas `on_balance` activas. Si el día de corte cambió (D10), se pide registrarlo como un movimiento.
- Pendiente: el contraste con los intereses reales de noviembre ($29.457,05 Visa, $38.172,61 Mastercard) necesita las compras de esos extractos, que llegan con la importación del paso 35. No se puede comparar todavía; se anotará la diferencia en ese paso.
- Nota: las tarjetas que ya tienen compras a cuotas no pueden pasar a `on_balance` (D32). Para las Bancolombia de producción, el modo debe quedar fijado antes de importar las compras (paso 35).
