import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { deferralCostSummary, estimatedInterest, interestSchedule, payInFullSavings, type DeferralPurchase } from "@/lib/domain/deferral-cost";
import { buildInstallmentPlan, type InProgressInput, type InstallmentRow } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import { projectStatements } from "@/lib/domain/months";
import type { Currency } from "@/lib/domain/money";
import { periodStartFor, dueDateFor } from "@/lib/domain/statements";

const d = (value: string) => new Decimal(value);
// 28,3288 % E.A., 2,1003 % M.V. (F21).
const rateEa = d("0.283288");

function purchase(options: { amount?: string; count?: number; mode?: InterestMode; date?: string; interestFree?: boolean; currency?: Currency; fxRate?: string; inProgress?: InProgressInput } = {}): Omit<DeferralPurchase, "rows"> & { rows: InstallmentRow[] } {
  const { amount = "9000", count = 36, mode = "on_balance", date = "2026-11-20", interestFree = false, currency = "COP", fxRate } = options;
  const plan = buildInstallmentPlan({ principal: d(amount), count, annualRateEa: rateEa, method: "fixed_principal", interestFree, currency, fxRate: fxRate ? d(fxRate) : undefined, cutoffDay: 15, purchaseDate: date, interestMode: mode, inProgress: options.inProgress });
  return { amount: d(amount), currency, fxRate: fxRate ? d(fxRate) : null, purchaseDate: date, rateEa, interestFree, interestMode: mode, cutoffDay: 15, installmentsCount: plan.rows.length, rows: plan.rows.length > 1 ? plan.rows : [] };
}

describe("costo de diferir (R11, D54)", () => {
  it("con intereses por cuota suma el interés de cada cuota: $9.000 a 36 cuotas da $3.496,99", () => {
    expect(estimatedInterest(purchase({ mode: "per_installment" })).toFixed(2)).toBe("3496.99");
  });

  it("con intereses sobre saldo suma R8 por extracto, sin el de la compra: $3.307,96 y 37 %", () => {
    const item = purchase();
    expect(estimatedInterest(item).toFixed(2)).toBe("3307.96");
    const schedule = interestSchedule(item);
    expect(schedule[0]).toEqual({ cutoffDate: "2026-12-15", interest: d("0") });
    expect(schedule).toHaveLength(36);
    const summary = deferralCostSummary(item, "2026-11-21");
    expect(summary.percent.toFixed(2)).toBe("0.37");
    expect(summary.exceedsThreshold).toBe(true);
    expect(summary.copReference).toBeNull();
  });

  it("da cero sin intereses, a una cuota o sin tasa", () => {
    expect(estimatedInterest(purchase({ interestFree: true })).isZero()).toBe(true);
    expect(estimatedInterest(purchase({ interestFree: true, mode: "per_installment" })).isZero()).toBe(true);
    expect(estimatedInterest(purchase({ count: 1 })).isZero()).toBe(true);
    expect(estimatedInterest({ ...purchase({ count: 1 }), rows: buildInstallmentPlan({ principal: d("9000"), count: 1, annualRateEa: rateEa, method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-11-20" }).rows }).isZero()).toBe(true);
    expect(estimatedInterest({ ...purchase(), rateEa: null }).isZero()).toBe(true);
    const summary = deferralCostSummary(purchase({ interestFree: true }), "2026-11-21");
    expect(summary.exceedsThreshold).toBe(false);
    expect(summary.total.isZero()).toBe(true);
  });

  it("en una compra en curso solo cuenta desde la cuota registrada: cuota 10 de 36 da $1.984,78", () => {
    const item = purchase({ date: "2026-02-01", inProgress: { currentInstallment: 10, trackedFromCutoff: "2026-11-15" } });
    expect(estimatedInterest(item).toFixed(2)).toBe("1984.78");
    expect(interestSchedule(item)[0]?.cutoffDate).toBe("2026-11-15");
  });

  it("separa lo causado en extractos cortados de lo que falta por causar", () => {
    const item = purchase({ date: "2026-02-01", inProgress: { currentInstallment: 10, trackedFromCutoff: "2026-11-15" } });
    const summary = deferralCostSummary(item, "2026-11-21");
    expect(summary.accrued.toFixed(2)).toBe(d("6750").times(d("0.021003")).toFixed(2));
    expect(summary.accrued.plus(summary.pending).toFixed(2)).toBe("1984.78");
    // Cut today is still open (R7).
    expect(deferralCostSummary(item, "2026-11-15").accrued.isZero()).toBe(true);
  });

  it("calcula en dólares con su equivalente en pesos con la TRM de la compra", () => {
    const item = purchase({ amount: "100", currency: "USD", fxRate: "4000" });
    const summary = deferralCostSummary(item, "2026-11-21");
    expect(summary.total.toFixed(2)).toBe(estimatedInterest(item).toFixed(2));
    expect(summary.total.decimalPlaces()).toBeLessThanOrEqual(2);
    expect(summary.copReference?.total.toFixed(2)).toBe(summary.total.times(4000).toFixed(2));
    expect(summary.copReference?.accrued.isZero()).toBe(true);
    expect(deferralCostSummary({ ...item, fxRate: null }, "2026-11-21").copReference).toBeNull();
  });

  it("incluye el abono a capital ponderado por días en el extracto donde se hizo (R9)", () => {
    const item = purchase({ date: "2026-08-20" });
    const withPrepayment = { ...item, prepayments: [{ cutoffDate: "2026-11-15", date: "2026-10-31", amount: d("1000") }] };
    const difference = estimatedInterest(withPrepayment).minus(estimatedInterest(item));
    // 15 of 31 days of the period at the higher balance.
    expect(difference.toFixed(2)).toBe(d("1000").times(15).div(31).times(d("0.021003")).toFixed(2));
    const elsewhere = { ...item, prepayments: [{ cutoffDate: "2025-11-15", date: "2025-10-31", amount: d("1000") }] };
    expect(interestSchedule(elsewhere).find((entry) => entry.cutoffDate === "2025-11-15")?.interest.isZero()).toBe(true);
  });

  it("cuadra con la estimación que proyectan los meses para esa compra", () => {
    const item = purchase({ amount: "1200000", count: 6, date: "2026-11-20" });
    const cutoffs = item.rows.map((row) => row.cutoffDate!);
    const result = projectStatements({
      cards: [{ id: "visa", cutoffDay: 15, paymentDay: 2, archived: false, handlingFee: d("0"), interestMode: "on_balance" }],
      statements: cutoffs.map((cutoff) => ({ id: cutoff, cardId: "visa", periodStart: periodStartFor(15, cutoff), cutoffDate: cutoff, dueDate: dueDateFor(2, cutoff), paidAt: null })),
      movements: [],
      installments: item.rows.map((row) => ({ id: `i${row.number}`, statementId: row.cutoffDate!, categoryId: null, totalCop: row.totalCop, total: row.total, currency: "COP",
        interestBasis: { principal: row.principal, balanceAfter: row.balanceAfter, purchaseDate: item.purchaseDate, rateEa, interestFree: false, currency: "COP", fxRate: null } })),
      subscriptions: [], fxRate: null, today: "2026-11-21",
    });
    const projected = result.statements.flatMap((statement) => statement.charges).filter((charge) => charge.concept === "interest").reduce((sum, charge) => sum.plus(charge.amount!), d("0"));
    expect(projected.gt(0)).toBe(true);
    expect(projected.toFixed(2)).toBe(estimatedInterest(item).toFixed(2));
  });
});

describe("ahorro por pagar el total (R11, D54)", () => {
  const older = purchase({ date: "2026-08-20" });
  const later = purchase({ date: "2026-11-20" });
  const dollars = purchase({ amount: "100", currency: "USD", fxRate: "4000", date: "2026-08-20" });

  it("suma los intereses de los extractos posteriores al periodo en curso, solo de compras hasta el corte y en esa moneda", () => {
    const savings = payInFullSavings([older, later, dollars], { currency: "COP", statementCutoff: "2026-11-15", today: "2026-11-21" });
    const expected = interestSchedule(older).filter((entry) => entry.cutoffDate > "2026-12-15").reduce((sum, entry) => sum.plus(entry.interest), d("0"));
    expect(expected.gt(0)).toBe(true);
    expect(savings.toFixed(2)).toBe(expected.toFixed(2));
  });

  it("da lo mismo con solo las cuotas por venir, incluso si queda una", () => {
    const options = { currency: "COP" as const, statementCutoff: "2026-11-15", today: "2026-11-21" };
    const future = { ...older, rows: older.rows.filter((row) => row.cutoffDate! > "2026-12-15") };
    expect(payInFullSavings([future], options).toFixed(2)).toBe(payInFullSavings([older], options).toFixed(2));
    const short = purchase({ count: 6, date: "2026-08-20" });
    const last = { ...short, rows: short.rows.slice(-1) };
    expect(payInFullSavings([last], { ...options, today: "2026-12-21" }).gt(0)).toBe(true);
  });

  it("en dólares solo cuenta las compras en dólares", () => {
    const savings = payInFullSavings([older, dollars], { currency: "USD", statementCutoff: "2026-11-15", today: "2026-11-21" });
    expect(savings.toFixed(2)).toBe(interestSchedule(dollars).filter((entry) => entry.cutoffDate > "2026-12-15").reduce((sum, entry) => sum.plus(entry.interest), d("0")).toFixed(2));
  });

  it("también aplica a tarjetas con intereses por cuota y da cero sin compras", () => {
    const item = purchase({ mode: "per_installment", date: "2026-08-20" });
    const expected = item.rows.filter((row) => row.cutoffDate! > "2026-12-15").reduce((sum, row) => sum.plus(row.interest), d("0"));
    expect(payInFullSavings([item], { currency: "COP", statementCutoff: "2026-11-15", today: "2026-11-21" }).toFixed(2)).toBe(expected.toFixed(2));
    expect(payInFullSavings([], { currency: "COP", statementCutoff: "2026-11-15", today: "2026-11-21" }).isZero()).toBe(true);
  });
});
