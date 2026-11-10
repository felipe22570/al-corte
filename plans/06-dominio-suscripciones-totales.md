# Paso 06 — Dominio: suscripciones y totales (R4, R5, R6)

- **Hito PRD:** H1 (parte 3 de 3) — **H1 termina aquí**
- **Estado:** ⬜ Pendiente
- **Inicio:** —
- **Fin:** —
- **Commit:** —
- **Depende de:** 05
- **Decisiones aplicables (decididas, ver README):** D2 (cupo disponible), D5 (gasto del mes)

## Objetivo

Funciones puras para fechas de cobro de suscripciones, totales del extracto por concepto, cupo disponible, utilización y gasto mensual. Al terminar, todo R1–R6 está cubierto con 100% de cobertura.

## API propuesta

`lib/domain/subscriptions.ts`

```ts
type Frequency = 'monthly' | 'yearly';
type SubscriptionStatus = 'active' | 'paused' | 'cancelled';
chargeDatesBetween(sub: { startDate; frequency; billingDay; status }, from: IsoDate, to: IsoDate): IsoDate[]
nextChargeDate(sub, today: IsoDate): IsoDate | null
monthlyEquivalent(amount: Decimal, frequency): Decimal     // anual / 12
yearlyEquivalent(amount: Decimal, frequency): Decimal      // mensual × 12
subscriptionTotals(subs: Array<{ amountCop; frequency; status }>): { monthly: Decimal; yearly: Decimal } // solo activas
isTrialEndingSoon(trialEndsAt: IsoDate | null, today: IsoDate, days = 7): boolean
```

Regla de fechas: la primera fecha de cobro es la primera fecha ≥ `startDate` cuyo día es `billingDay` (ajustado a fin de mes). Para `yearly`, el mes de cobro es el mes de `startDate`. Si hay prueba gratis, el primer cobro es el primero ≥ `trialEndsAt` (decidido con la propuesta por defecto).

`lib/domain/totals.ts`

```ts
type StatementConcept = 'single_purchases' | 'installments' | 'subscriptions' | 'cash_advances'
  | 'interest' | 'handling_fees' | 'insurance' | 'adjustments' | 'refunds' | 'payments';
statementTotals(items: StatementItem[]): { byConcept: Record<StatementConcept, Decimal>; total: Decimal; payments: Decimal }
availableCredit(input: { creditLimit; charges; billedInstallmentInterest; payments; refunds }): { used; available; utilization }
monthlySpending(transactions, month: 'YYYY-MM'): Decimal
compareMonths(current: Decimal, previous: Decimal): { diff: Decimal; pct: Decimal | null }
```

- Total = compras de 1 cuota + cuotas (capital + interés) + suscripciones + avances y comisiones + intereses + cuotas de manejo + seguros + ajustes − devoluciones. Pagos aparte. (Los ajustes no están en la fórmula de R5; incluirlos como concepto propio y anotarlo como decisión.)
- Utilización con cupo 0 → 0 (sin dividir por cero).
- Todos los montos en COP (R6): `amount_cop` para movimientos y `total_cop` / `interest_cop` para cuotas, también en compras en USD amortizadas en USD (D3).

## Casos de prueba obligatorios

Suscripciones:

- [ ] Mensual con día de cobro 31, inicio 2026-01-10: cobros 2026-01-31, 2026-02-28, 2026-03-31, 2026-04-30.
- [ ] Mensual con día 31 en año bisiesto: 2028-02-29.
- [ ] Anual con inicio 2027-02-28 y día 29 → 2027-02-28, 2028-02-29 (bisiesto) y 2029-02-28.
- [ ] Anual con inicio 2028-02-29 (día 29) → 2029-02-28, 2030-02-28, 2032-02-29.
- [ ] Inicio el mismo día del cobro → ese día cuenta.
- [ ] Pausada o cancelada → `chargeDatesBetween` devuelve `[]`.
- [ ] Rango de 7 días (recuperación del cron): devuelve solo las fechas dentro del rango, sin duplicados.
- [ ] Prueba gratis: no hay cobros antes de `trialEndsAt`.
- [ ] `subscriptionTotals`: 2 mensuales (10.000 y 20.000) + 1 anual (120.000) + 1 pausada → mensual 40.000, anual 480.000.

Totales:

- [ ] Extracto con una compra de 1 cuota, dos cuotas de compras distintas, una suscripción, un avance con su comisión, una cuota de manejo, un seguro, una devolución y un pago: el total por concepto y el total general coinciden con un cálculo hecho a mano en la prueba; el pago no reduce el total y aparece en `payments`.
- [ ] Compra a N cuotas: el movimiento padre no se suma al extracto, solo sus cuotas.
- [ ] Extracto con una cuota de una compra en USD: suma su `total_cop`, no su `total` en USD.
- [ ] Cupo: cupo 5.000.000, cargos 1.500.000, intereses facturados 20.000, pagos 500.000, devoluciones 20.000 → usado 1.000.000, disponible 4.000.000, utilización 20%.
- [ ] Cupo 0 → utilización 0.
- [ ] Gasto del mes: incluye compras (valor completo) y avances; excluye pagos, intereses y comisiones; resta devoluciones (D5).
- [ ] `compareMonths` con mes anterior 0 → `pct = null`.

## Archivos

- `lib/domain/subscriptions.ts`, `lib/domain/totals.ts`
- `lib/domain/__tests__/subscriptions.test.ts`, `lib/domain/__tests__/totals.test.ts`
- `lib/domain/index.ts` (opcional: reexporta la API pública)

## Verificación

```
pnpm test
pnpm test:coverage            # 100% líneas/ramas/funciones/sentencias en lib/domain/**
pnpm typecheck && pnpm lint
```

Revisión manual contra `AGENTS.md` → "Casos de prueba obligatorios en lib/domain/":

- [ ] Compra el mismo día del corte y un día después (paso 04).
- [ ] Corte el 31 en febrero normal, bisiesto y meses de 30 días (paso 04).
- [ ] Fecha de pago en el mes siguiente al corte (paso 04).
- [ ] 12 cuotas con ambos métodos, Σ capital = P (paso 05).
- [ ] 1 cuota y sin intereses: interés 0 (paso 05).
- [ ] Suscripción mensual con día 31 (este paso).
- [ ] Suscripción anual que renueva en año bisiesto (este paso).

## Criterios de terminado

- Verificaciones en verde y checklist completo → **H1 terminado**.
- Commit: `feat: add subscription schedule and statement totals (R4, R5, R6)`.
- Etiqueta opcional: `git tag h1`.

## Notas de progreso

<!-- Fecha — nota -->
