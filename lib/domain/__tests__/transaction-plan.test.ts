import { describe, expect, it } from "vitest";
import { buildTransactionPlan, type TransactionPlanInput } from "@/lib/domain/transaction-plan";

const card = { id: "card-a", cutoffDay: 15, paymentDay: 5, purchaseRateEa: "0.28", advanceRateEa: "0.36", advanceFee: "15000", amortizationMethod: "fixed_principal" as const };
const base: TransactionPlanInput = { cardId: "card-a", type: "purchase", date: "2026-01-20", amount: "1000000", currency: "COP", installmentsCount: 1, interestFree: false, categoryId: null, merchant: "Tienda", note: "" };

describe("transaction plan", () => {
  it("crea una compra COP a una cuota sin filas de cuotas", () => {
    const result = buildTransactionPlan(base, card);
    expect(result.payload.amount_cop).toBe("1000000");
    expect(result.payload.installments).toEqual([]);
    expect(result.firstCutoff).toBe("2026-02-15");
    expect(result.dueDate).toBe("2026-03-05");
    expect(result.firstInstallment).toBe("1000000");
  });
  it("genera cuotas con la tasa de compra congelada", () => {
    const result = buildTransactionPlan({ ...base, installmentsCount: 6 }, card);
    expect(result.payload.installments).toHaveLength(6);
    expect(result.payload.rate_ea_applied).toBe("0.28");
    expect(result.payload.installments[0]?.cutoff_date).toBe("2026-02-15");
  });
  it("conserva la tasa aplicada al editar sin cambiar tarjeta ni tipo", () => {
    const result = buildTransactionPlan({ ...base, installmentsCount: 6 }, card, { cardId: "card-a", type: "purchase", rateEaApplied: "0.18" });
    expect(result.payload.rate_ea_applied).toBe("0.18");
    expect(result.totalInterest).not.toBe(buildTransactionPlan({ ...base, installmentsCount: 6 }, card).totalInterest);
  });
  it("usa la tasa vigente al cambiar tarjeta o tipo", () => {
    expect(buildTransactionPlan(base, card, { cardId: "other", type: "purchase", rateEaApplied: "0.18" }).payload.rate_ea_applied).toBe("0.28");
    expect(buildTransactionPlan({ ...base, type: "cash_advance" }, card, { cardId: "card-a", type: "purchase", rateEaApplied: "0.18" }).payload.rate_ea_applied).toBe("0.36");
  });
  it("usa la tasa vigente cuando el movimiento original no tiene una tasa guardada", () => {
    expect(buildTransactionPlan(base, card, { cardId: "card-a", type: "purchase", rateEaApplied: null }).payload.rate_ea_applied).toBe("0.28");
  });
  it("amortiza USD y conserva su equivalente COP", () => {
    const result = buildTransactionPlan({ ...base, amount: "100", currency: "USD", fxRate: "4000", installmentsCount: 3 }, card);
    expect(result.payload.amount_cop).toBe("400000");
    expect(result.payload.installments[0]).toMatchObject({ principal: "33.33", interest: "2.08", total_cop: "141640" });
  });
  it("usa la tasa de avances y muestra la comisión en COP", () => {
    const result = buildTransactionPlan({ ...base, type: "cash_advance", amount: "500000", installmentsCount: 2 }, card);
    expect(result.payload.rate_ea_applied).toBe("0.36");
    expect(result.advanceFee).toBe("15000");
  });
  it("permite promociones sin intereses", () => {
    const result = buildTransactionPlan({ ...base, installmentsCount: 6, interestFree: true }, card);
    expect(result.totalInterest).toBe("0");
    expect(result.payload.rate_ea_applied).toBe("0.28");
  });
  it("registra pagos sin cuotas ni tasa aplicada", () => {
    const result = buildTransactionPlan({ ...base, type: "payment" }, card);
    expect(result.payload.rate_ea_applied).toBeNull();
    expect(result.payload.installments).toEqual([]);
  });
  it("marca los movimientos normales sin cuotas previas", () => {
    const result = buildTransactionPlan({ ...base, installmentsCount: 2 }, card);
    expect(result.payload).toMatchObject({ prior_installments: 0, prior_principal_paid: "0", original_installments_count: null, tracked_from_cutoff: null });
    expect(result.payload.installments.every((row) => row.before_tracking === false)).toBe(true);
  });
  it("arma una compra en curso en el extracto de la cuota k, sin cortes anteriores", () => {
    const result = buildTransactionPlan({ ...base, date: "2026-04-16", amount: "600000", installmentsCount: 24, inProgress: { currentInstallment: 7, balanceAfter: "269998.46", trackedFromCutoff: "2026-11-15" } }, card);
    expect(result.firstCutoff).toBe("2026-11-15");
    expect(result.dueDate).toBe("2026-12-05");
    expect(result.firstInstallment).toBe(result.payload.installments[6]?.total);
    expect(result.payload).toMatchObject({ installments_count: 18, original_installments_count: 24, prior_installments: 6, prior_principal_paid: "305001.54", tracked_from_cutoff: "2026-11-15" });
    expect(result.payload.installments.slice(0, 6).every((row) => row.before_tracking && row.cutoff_date === null && row.interest === "0")).toBe(true);
    expect(result.payload.installments[6]).toMatchObject({ number: 7, cutoff_date: "2026-11-15", before_tracking: false });
  });
  it("no cobra comisión a un avance en curso", () => {
    const result = buildTransactionPlan({ ...base, type: "cash_advance", amount: "600000", installmentsCount: 24, inProgress: { currentInstallment: 7, balanceAfter: null, trackedFromCutoff: "2026-11-15" } }, card);
    expect(result.advanceFee).toBe("0");
    expect(result.payload.original_installments_count).toBeNull();
  });
  it("rechaza una tarjeta diferente a la solicitada", () => {
    expect(() => buildTransactionPlan({ ...base, cardId: "other" }, card)).toThrow("La tarjeta no coincide");
  });
});
