# Paso 27 — Compras en curso: datos y dominio

- **Hito PRD:** H10 (parte 1 de 9)
- **Estado:** ⬜ Pendiente
- **Inicio:**
- **Fin:**
- **Commit:**
- **Depende de:** 26
- **Decisiones aplicables (decididas, ver README):** D1, D2, D3, D15, D31, D48, D49, D50

## Objetivo

Poder guardar una compra que ya tenía cuotas pagadas antes de Al Corte, con su plan completo, sin que las cuotas previas afecten extractos, meses ni cupo (F10, R8). Este paso también cambia el redondeo de COP a centavos (D48), porque sus pruebas lo necesitan.

## Contenido

- Centavos en COP (D48), antes que lo demás:
    - `roundMoney` redondea COP a 2 decimales. `toCop` y las conversiones de USD también, en TypeScript y en SQL (`round(x, 2)` en la RPC de registro y en `generate_subscription_charge_on`).
    - `lib/format.ts` sigue mostrando pesos enteros. Revisar que ningún cálculo use el valor ya formateado.
    - Ajustar las pruebas existentes que suponen pesos enteros; los datos guardados no se migran.
- Migración:
    - `transactions.prior_installments smallint not null default 0` (0 ≤ p < plan efectivo), `transactions.prior_principal_paid numeric(14,2) not null default 0` (0 ≤ c < `amount`) y `transactions.original_installments_count smallint` (N original cuando el plan efectivo difiere; nulo si no). En USD, el capital previo va en USD y su equivalente COP se calcula con la TRM de la compra (D3).
    - `installments.before_tracking boolean not null default false` y `installments.statement_id` nulo solo cuando `before_tracking` es verdadero (`check`).
    - Límite de D50: `transactions.installments_count` e `installments.number` pasan de 36 a 72. Las compras nuevas siguen limitadas a 36 en Zod y en la RPC (D15).
    - La RPC transaccional de registro y edición acepta `prior_installments`, `prior_principal_paid` y el corte del extracto de la cuota k (`tracked_from_cutoff`). Valida que sea un corte válido de la tarjeta y que las cuotas siguientes caigan en los cortes consecutivos.
    - Con cuotas previas, el movimiento queda en el extracto de la cuota k, no en el que da R1 por su fecha. No se llama a `ensure_statement` para cortes anteriores (evita extractos viejos con cuota de manejo por D1) y no se crea la comisión de un avance en curso.
- Dominio (`lib/domain/installments.ts` o un módulo nuevo):
    - Entrada según D49: cuota k y saldo opcional, copiados del último extracto del banco. p = k − 1; con saldo, c = P − saldo − cuota; sin saldo, c = p × cuota. La cuota es P/N redondeada a centavos.
    - p filas previas con interés 0 y sin extracto; c se reparte por igual entre ellas y la última absorbe el redondeo.
    - Plan consistente: si c = p × cuota con la tolerancia de redondeo, se conserva N.
    - Plan con abono previo: si no coincide, misma cuota y plan efectivo de p + ⌈(P − c) ÷ cuota⌉ cuotas, con la última por el resto (manda el saldo del banco). `installments_count` guarda el plan efectivo y `original_installments_count` el N original.
    - `installmentProgress` y los tipos de fila admiten cuotas sin fecha de corte (previas) y cuentan el progreso sobre el plan efectivo.
- Cupo (D2): el capital de una compra en curso cuenta como `amount − prior_principal_paid` (en COP, `amount_cop` menos el equivalente del capital previo). Actualizar `card_balances` y sus pruebas.
- Meses (R7): las cuotas `before_tracking` se excluyen de extractos reales, virtuales, desgloses y totales. Hoy salen solas porque se leen por `statement_id`; agregar una prueba que lo fije.
- Exportación: columnas nuevas en `lib/export-schema.ts`.

## Tareas

- [ ] Cambio a centavos en COP con sus pruebas.
- [ ] Migración con restricciones y RLS sin cambios de alcance.
- [ ] RPC de registro y edición, con pruebas SQL de extracto de la cuota k, sin extractos antiguos ni comisión.
- [ ] Dominio y pruebas; cobertura de `lib/domain/` en 100 %.
- [ ] Actualizar la vista `card_balances` y `lib/domain/months.ts` donde corresponda.
- [ ] Exportación y `lib/database.types.ts` regenerado.

## Pruebas

Los saldos de los ejemplos son los del extracto, después de la cuota k (D49). Los cuatro casos se comprobaron con esa lectura.

- [ ] IKEA de la Visa: $451.860 a 4 cuotas, cuota 3 de 4, saldo $112.965 → 2 cuotas previas, cuota actual $112.965, una restante.
- [ ] Avance de la Mastercard del 16 de abril: $600.000, cuota 7 de 24, cuota $25.000, saldo después del extracto $269.998,46 → plan efectivo de 18 cuotas y última de $19.998,46. Sin comisión nueva.
- [ ] GeoGuessr: $131.904,26, cuota 10 de 36, saldo $88.810,60 → cuota $3.664,01, plan efectivo de 35 y última de $874,36 (con pesos enteros daría $874,60).
- [ ] Fanova (USD): US$11,22, cuota 3 de 36, saldo US$7,33 → plan efectivo de 27 y última de US$0,20.
- [ ] Saldo del banco mayor al plan: el plan efectivo puede superar N, hasta 72.
- [ ] Cupo: una compra en curso solo resta su capital pendiente; las cuotas previas no aparecen en ningún extracto ni mes.
- [ ] Registrar una compra en curso de abril no crea extractos de abril a octubre ni cuotas de manejo en ellos.

## Verificación

```
pnpm typecheck && pnpm lint && pnpm test && pnpm test:coverage
supabase db reset && supabase test db
```

## Criterios de terminado

- Verificaciones en verde y Definición de terminado global.
- Commit: `feat: support purchases with installments paid before tracking`.

## Notas de progreso

<!-- Fecha — nota -->
