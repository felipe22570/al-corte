# Paso 05 — Dominio: dinero, tasas, cuotas y avances (R2, R3)

- **Hito PRD:** H1 (parte 2 de 3)
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 04
- **Decisiones aplicables (decididas, ver README):** D3 (cuotas de compras en USD), D8 (avance a 1 cuota)

## Objetivo

Funciones puras para dinero (`money.ts`), tasas (`rates.ts`), tabla de amortización (`installments.ts`) y avances (`advances.ts`), con pruebas primero.

## API propuesta

`lib/domain/money.ts`

```ts
export type Currency = 'COP' | 'USD';
toDecimal(v: string | Decimal): Decimal          // rechaza number para evitar errores
roundMoney(v: Decimal, currency: Currency): Decimal // COP → entero HALF_UP; USD → 2 decimales
toCop(amount: Decimal, currency: Currency, fxRate?: Decimal): Decimal
formatMoney(v: string | Decimal, currency: Currency): string // Intl.NumberFormat('es-CO', …)
```

`lib/domain/rates.ts`

```ts
monthlyRateFromEA(ea: Decimal): Decimal   // (1 + EA)^(1/12) − 1 con precisión alta
```

`lib/domain/installments.ts`

```ts
type AmortizationMethod = 'fixed_principal' | 'french';
interface InstallmentRow {
  number; principal; interest; total; balanceAfter; cutoffDate;   // en la moneda de la compra
  principalCop; interestCop; totalCop;                             // equivalente en COP (D3)
}
buildInstallmentPlan(input: {
  principal: Decimal; count: number; annualRateEa: Decimal; method: AmortizationMethod;
  interestFree: boolean; currency: Currency; fxRate?: Decimal;     // fxRate obligatorio si USD
  cutoffDay: number; purchaseDate: IsoDate;
}): {
  monthlyRate: Decimal; rows: InstallmentRow[]; amountCop: Decimal;
  totalInterest: Decimal; totalInterestCop: Decimal; firstInstallment: InstallmentRow;
}
installmentProgress(rows, today): { current: number; count: number; pendingPrincipal: Decimal } // ej. 4/12
```

`lib/domain/advances.ts`

```ts
buildCashAdvance(input: { amount; count; card: { advanceRateEa; advanceFee; amortizationMethod; cutoffDay }; date })
  : { advance: { plan }, fee: { amount; type: 'advance_fee'; date; cutoffDate } }
```

## Reglas a implementar

- `i = (1 + EA)^(1/12) − 1`; `Decimal.set({ precision: 40 })` o configurar un clon de `Decimal` local para no afectar a otros módulos.
- **Capital fijo:** capital_k = round(P/N); interés_k = round(S_(k−1) · i); la última cuota toma capital = saldo restante.
- **Cuota fija:** C = round(P · i / (1 − (1 + i)^(−N))); interés_k = round(S_(k−1) · i); capital_k = C − interés_k; la última cuota toma capital = saldo restante y total = capital + interés.
- `count === 1` o `interestFree` → i = 0 (y `rate_ea_applied` sigue guardando la tasa de la tarjeta para referencia, decidir en el paso 11).
- Cuota k → `shiftStatement(cutoffDay, statementCutoffFor(cutoffDay, purchaseDate), k − 1)`.
- `balanceAfter` de la última cuota = 0 exacto.
- `round` depende de la moneda (`roundMoney`): COP a pesos enteros, USD a centavos.
- **Compras en USD (D3):** la amortización se calcula en USD sobre `amount`. Luego, para cada cuota:
  - `amountCop = round_COP(amount × fxRate)`.
  - `principalCop_k = round_COP(principal_k × fxRate)`; la última cuota toma `amountCop − Σ principalCop` anteriores (Σ `principalCop` = `amountCop` exacto).
  - `interestCop_k = round_COP(interest_k × fxRate)`; `totalCop_k = principalCop_k + interestCop_k`.
  - Se usa la TRM de la compra para todas las cuotas; son valores estimados hasta la conciliación (v2).
- **Compras en COP:** `fxRate` no aplica; las columnas `Cop` son iguales a las originales y `amountCop = P`.
- Validación: P > 0, 1 ≤ N ≤ 48 (límite razonable; confirmar), EA ≥ 0, `fxRate > 0` obligatorio si la moneda es USD y prohibido si es COP.

## Casos de prueba obligatorios

Ejemplo de referencia (P = 1.000.000 COP, N = 3, EA = 28%, i ≈ 0,0207847285):

Capital fijo:

| k | Capital | Interés | Total | Saldo |
| --- | --- | --- | --- | --- |
| 1 | 333.333 | 20.785 | 354.118 | 666.667 |
| 2 | 333.333 | 13.856 | 347.189 | 333.334 |
| 3 | 333.334 | 6.928 | 340.262 | 0 |

Cuota fija (C = 347.285):

| k | Capital | Interés | Total | Saldo |
| --- | --- | --- | --- | --- |
| 1 | 326.500 | 20.785 | 347.285 | 673.500 |
| 2 | 333.286 | 13.999 | 347.285 | 340.214 |
| 3 | 340.214 | 7.071 | 347.285 | 0 |

Ejemplo de referencia en USD (D3): P = 100,00 USD, N = 3, EA = 28%, TRM = 4.000 → `amountCop` = 400.000.

Capital fijo:

| k | Capital USD | Interés USD | Total USD | Saldo USD | Capital COP | Interés COP | Total COP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 33,33 | 2,08 | 35,41 | 66,67 | 133.320 | 8.320 | 141.640 |
| 2 | 33,33 | 1,39 | 34,72 | 33,34 | 133.320 | 5.560 | 138.880 |
| 3 | 33,34 | 0,69 | 34,03 | 0,00 | 133.360 | 2.760 | 136.120 |

Cuota fija (C = 34,73 USD):

| k | Capital USD | Interés USD | Total USD | Saldo USD | Capital COP | Interés COP | Total COP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 32,65 | 2,08 | 34,73 | 67,35 | 130.600 | 8.320 | 138.920 |
| 2 | 33,33 | 1,40 | 34,73 | 34,02 | 133.320 | 5.600 | 138.920 |
| 3 | 34,02 | 0,71 | 34,73 | 0,00 | 136.080 | 2.840 | 138.920 |

Además:

- [ ] Compra en USD a 12 cuotas con ambos métodos y una TRM con decimales (p. ej. 4.123,57): Σ capital USD = `amount` exacto, Σ `principalCop` = `amountCop` exacto, `totalCop = principalCop + interestCop` en cada fila, valores USD con 2 decimales y COP enteros.
- [ ] Compra en USD sin `fxRate` → error; compra en COP con `fxRate` → error.
- [ ] Compra a 12 cuotas con `fixed_principal` y con `french` (p. ej. P = 1.234.567, EA = 0,2899): Σ capital = P **exactamente**, último saldo = 0, cuotas con capital fijo decrecientes, cuotas francesas iguales salvo la última (diferencia ≤ 1 peso).
- [ ] Compra en COP: columnas `Cop` iguales a las originales.
- [ ] Compra a 1 cuota: interés 0, una fila, total = P.
- [ ] Compra a 6 cuotas "sin intereses": todas con interés 0, Σ capital = P.
- [ ] `monthlyRateFromEA(0)` = 0; `monthlyRateFromEA(0.28)` ≈ 0,020784728 (comparar con 9 decimales).
- [ ] Asignación de cuotas: compra 2026-01-20 con corte 15 y 3 cuotas → cortes 2026-02-15, 2026-03-15, 2026-04-15. Compra 2026-01-31 con corte 31 → 2026-01-31, 2026-02-28, 2026-03-31.
- [ ] Avance de 500.000 a 2 cuotas con tasa de avances distinta a la de compras: usa la tasa de avances; la comisión tiene la misma fecha y el mismo corte que la cuota 1 del avance.
- [ ] `roundMoney` HALF_UP: 0,5 → 1; 1,5 → 2; USD 1,005 → 1,01.
- [ ] `formatMoney('1234567', 'COP')` coincide con `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` (comparar contra el resultado de Intl, no contra un literal, por diferencias de espacios no separables entre versiones de ICU).
- [ ] `toDecimal(1.1 as any)` lanza error (no se acepta `number`).
- [ ] `installmentProgress`: compra a 12 cuotas con 3 cortes ya pasados → 4/12 y saldo pendiente correcto.
- [ ] Entradas inválidas (P ≤ 0, N = 0, EA negativa) lanzan error.

## Archivos

- `lib/domain/money.ts`, `rates.ts`, `installments.ts`, `advances.ts`
- `lib/domain/__tests__/money.test.ts`, `rates.test.ts`, `installments.test.ts`, `advances.test.ts`

## Riesgos

- El banco puede calcular el interés de la primera cuota de forma proporcional a los días. El PRD no lo contempla: se usa la fórmula del PRD y las diferencias se ajustan en la conciliación (v2).
- La precisión de `Decimal.pow` con exponente fraccionario: fijar precisión ≥ 30 dígitos.

## Verificación

```
pnpm test
pnpm test:coverage            # 100% en lib/domain/**
pnpm typecheck && pnpm lint
```

Revisión manual:

- [ ] Las dos tablas de referencia están como pruebas con los valores exactos.
- [ ] `grep -nE "(\+|-|\*|/) ?[0-9.]+" lib/domain/money.ts lib/domain/installments.ts` no muestra aritmética de dinero con `number` (revisar a ojo los resultados).
- [ ] Ningún tipo público usa `number` para montos.

## Criterios de terminado

- Verificaciones en verde.
- Commit: `feat: add installment amortization and cash advance rules (R2, R3)`.

## Notas de progreso

<!-- Fecha — nota -->
