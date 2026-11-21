import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { changeInstallments, installmentChangePayload, planInterest } from "@/lib/domain/installment-changes";
import { buildInstallmentPlan, type AmortizationMethod } from "@/lib/domain/installments";
import type { Currency } from "@/lib/domain/money";
import { applyPrepayment, type PaymentTarget } from "@/lib/domain/payments";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import { statementCutoffFor } from "@/lib/domain/statements";

const d = (value: string | number) => new Decimal(value);
const total = (values: Decimal[]) => values.reduce((sum, value) => sum.plus(value), d(0));

function target(options: { amount: string; count: number; date: string; currency?: Currency; fxRate?: string; rateEa?: string; method?: AmortizationMethod; perInstallment?: boolean }): PaymentTarget {
  const currency = options.currency ?? "COP";
  const fxRate = options.fxRate ? d(options.fxRate) : null;
  const plan = buildInstallmentPlan({
    principal: d(options.amount), count: options.count, annualRateEa: d(options.rateEa ?? "0"), method: options.method ?? "fixed_principal", interestFree: false,
    currency, fxRate: fxRate ?? undefined, cutoffDay: 15, purchaseDate: options.date, interestMode: options.perInstallment ? "per_installment" : "on_balance",
  });
  return {
    id: "compra", type: "purchase", date: options.date, currency, installmentsCount: options.count, interestFree: false, isInternational: false,
    statementCutoff: statementCutoffFor(15, options.date),
    terms: { amount: d(options.amount), amountCop: plan.amountCop, currency, fxRate, method: options.method ?? "fixed_principal", monthlyRate: plan.monthlyRate },
    rows: plan.rows, prepayments: [],
  };
}
const rate = monthlyRateFromEA(d("0.2899"));

describe("cambio de cuotas (F16, D40, D50)", () => {
  it("de 36 cuotas en la cuota 3 a 1 cuota restante: la siguiente es todo el saldo", () => {
    // 2 cuotas facturadas (15 oct y 15 nov); la 3 es la del 15 de diciembre.
    const purchase = target({ amount: "3600000", count: 36, date: "2026-10-10" });
    const change = changeInstallments({ target: purchase, remaining: 1, date: "2026-11-21", cutoffDay: 15, interestRate: rate });
    expect(change.replacedFromNumber).toBe(3);
    expect(change.rows.map((row) => [row.number, row.principal.toString(), row.cutoffDate, row.balanceAfter.toString()])).toEqual([[3, "3400000", "2026-12-15", "0"]]);
    expect(change.effectivePlan).toBe(3);
    expect(change.interestDifference.isNegative()).toBe(true);
  });

  it("de 6 cuotas con 1 facturada a 12 restantes: plan efectivo de 13 sobre el mismo saldo", () => {
    const purchase = target({ amount: "600000", count: 6, date: "2026-11-10" });
    const change = changeInstallments({ target: purchase, remaining: 12, date: "2026-11-21", cutoffDay: 15, interestRate: rate });
    expect(change.pending.toString()).toBe("500000");
    expect(change.effectivePlan).toBe(13);
    expect(change.rows.map((row) => row.cutoffDate)).toEqual(Array.from({ length: 12 }, (_, index) => `${index < 1 ? 2026 : 2027}-${String((index + 11) % 12 + 1).padStart(2, "0")}-15`));
    expect(total(change.rows.map((row) => row.principal)).toString()).toBe("500000");
    expect(change.nextInstallment.toString()).toBe("41666.67");
    expect(change.previousInstallment.toString()).toBe("100000");
    expect(change.interestDifference.isPositive()).toBe(true);
  });

  it("de 36 cuotas con 10 facturadas a 36 restantes: plan efectivo de 46 (D50); más de 36 o de 72 se rechaza", () => {
    const purchase = target({ amount: "3600000", count: 36, date: "2026-02-10" });
    const change = changeInstallments({ target: purchase, remaining: 36, date: "2026-11-21", cutoffDay: 15, interestRate: rate });
    expect(change.effectivePlan).toBe(46);
    expect(change.rows.at(-1)).toMatchObject({ number: 46, cutoffDate: "2029-11-15" });
    expect(() => changeInstallments({ target: purchase, remaining: 37, date: "2026-11-21", cutoffDay: 15, interestRate: rate })).toThrow("entre 1 y 36");
    expect(() => changeInstallments({ target: purchase, remaining: 1.5, date: "2026-11-21", cutoffDay: 15, interestRate: rate })).toThrow("entre 1 y 36");
    const long = { ...purchase, rows: [...Array(45).keys()].map((index) => ({ ...purchase.rows[0]!, number: index + 1, beforeTracking: index < 40, cutoffDate: index < 40 ? null : purchase.rows[index - 30]!.cutoffDate })) };
    expect(() => changeInstallments({ target: long, remaining: 36, date: "2026-11-21", cutoffDay: 15, interestRate: rate })).toThrow("72 cuotas");
  });

  it("con intereses por cuota recalcula con el método de la tarjeta y la tasa de la compra", () => {
    const purchase = target({ amount: "1200000", count: 12, date: "2026-10-10", rateEa: "0.2899", perInstallment: true, method: "french" });
    const change = changeInstallments({ target: purchase, remaining: 6, date: "2026-11-21", cutoffDay: 15, interestRate: rate });
    const payments = new Set(change.rows.slice(0, -1).map((row) => row.total.toString()));
    expect(payments.size).toBe(1);
    expect(change.interestAfter.toString()).toBe(total(change.rows.map((row) => row.interest)).toString());
    expect(planInterest(purchase.rows.slice(2), rate, "COP").toString()).toBe(total(purchase.rows.slice(2).map((row) => row.interest)).toString());
  });

  it("conserva abonos previos y el equivalente en pesos", () => {
    const usd = target({ amount: "120", count: 12, date: "2026-10-12", currency: "USD", fxRate: "4000" });
    const prepaid = applyPrepayment({ target: usd, amount: d("10"), date: "2026-11-19", effect: "reduce_term" });
    const after = { ...usd, rows: [...usd.rows.slice(0, 2), ...prepaid.rows!], prepayments: [{ amount: d("10"), amountCop: prepaid.amountCop, date: "2026-11-19" }] };
    const change = changeInstallments({ target: after, remaining: 3, date: "2026-11-21", cutoffDay: 15, interestRate: rate });
    expect(change.pending.toString()).toBe("90");
    expect(total([...after.rows.slice(0, 2).map((row) => row.principalCop), prepaid.amountCop, ...change.rows.map((row) => row.principalCop)]).toString()).toBe("480000");
    expect(installmentChangePayload("compra", 3, change)).toMatchObject({ transaction_id: "compra", remaining_installments: 3, replaced_from_number: 3, installments: [expect.objectContaining({ number: 3, principal: "30" }), expect.anything(), expect.anything()] });
  });

  it("rechaza cuotas restantes que el saldo no alcanza a cubrir", () => {
    const tiny = target({ amount: "0.30", count: 2, date: "2026-11-20" });
    expect(() => changeInstallments({ target: tiny, remaining: 36, date: "2026-11-21", cutoffDay: 15, interestRate: rate })).toThrow("muy pequeño");
  });

  it("no cambia una compra sin cuotas por facturar", () => {
    const purchase = target({ amount: "300000", count: 3, date: "2026-08-10" });
    expect(() => changeInstallments({ target: purchase, remaining: 2, date: "2026-11-21", cutoffDay: 15, interestRate: rate })).toThrow("no tiene cuotas por facturar");
  });
});
