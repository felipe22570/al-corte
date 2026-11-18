import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { buildInstallmentPlan, installmentProgress } from "@/lib/domain/installments";

const decimal = (value: string | number) => new Decimal(value);

describe("installments", () => {
  it("builds the COP fixed-principal reference plan", () => {
    const plan = buildInstallmentPlan({ principal: decimal("1000000"), count: 3, annualRateEa: decimal("0.28"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    expect(plan.rows.map(({ principal, interest, total, balanceAfter }) => [principal.toString(), interest.toString(), total.toString(), balanceAfter.toString()])).toEqual([
      ["333333.33", "20784.73", "354118.06", "666666.67"], ["333333.33", "13856.49", "347189.82", "333333.34"], ["333333.34", "6928.24", "340261.58", "0"],
    ]);
    expect(plan.rows.map((row) => row.cutoffDate)).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
    expect(plan.rows.every((row) => !row.beforeTracking)).toBe(true);
  });

  it("builds French installments and makes the final balance exact", () => {
    const plan = buildInstallmentPlan({ principal: decimal("1000000"), count: 3, annualRateEa: decimal("0.28"), method: "french", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    expect(plan.rows.map((row) => row.total.toString())).toEqual(["347284.83", "347284.83", "347284.83"]);
    expect(plan.rows.at(-1)?.balanceAfter.toString()).toBe("0");
    expect(plan.rows.reduce((sum, row) => sum.plus(row.principal), decimal(0)).toString()).toBe("1000000");
  });

  it("calculates USD installments and matching COP equivalents", () => {
    const plan = buildInstallmentPlan({ principal: decimal("100"), count: 3, annualRateEa: decimal("0.28"), method: "fixed_principal", interestFree: false, currency: "USD", fxRate: decimal("4000"), cutoffDay: 31, purchaseDate: "2026-01-31" });
    expect(plan.amountCop.toString()).toBe("400000");
    expect(plan.rows.map(({ principal, interest, total, principalCop, interestCop, totalCop, cutoffDate }) => [principal.toString(), interest.toString(), total.toString(), principalCop.toString(), interestCop.toString(), totalCop.toString(), cutoffDate])).toEqual([
      ["33.33", "2.08", "35.41", "133320", "8320", "141640", "2026-01-31"], ["33.33", "1.39", "34.72", "133320", "5560", "138880", "2026-02-28"], ["33.34", "0.69", "34.03", "133360", "2760", "136120", "2026-03-31"],
    ]);
  });

  it("keeps exact principal totals for both methods and currencies", () => {
    for (const method of ["fixed_principal", "french"] as const) {
      const copPlan = buildInstallmentPlan({ principal: decimal("1234567"), count: 12, annualRateEa: decimal("0.2899"), method, interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
      const usdPlan = buildInstallmentPlan({ principal: decimal("1234.56"), count: 12, annualRateEa: decimal("0.2899"), method, interestFree: false, currency: "USD", fxRate: decimal("4123.57"), cutoffDay: 15, purchaseDate: "2026-01-20" });
      expect(copPlan.rows.reduce((sum, row) => sum.plus(row.principal), decimal(0)).equals("1234567")).toBe(true);
      expect(usdPlan.rows.reduce((sum, row) => sum.plus(row.principal), decimal(0)).equals("1234.56")).toBe(true);
      expect(usdPlan.rows.reduce((sum, row) => sum.plus(row.principalCop), decimal(0)).equals(usdPlan.amountCop)).toBe(true);
      expect(usdPlan.rows.every((row) => row.totalCop.equals(row.principalCop.plus(row.interestCop)))).toBe(true);
    }
  });

  it("does not add interest to one installment or interest-free purchases", () => {
    const one = buildInstallmentPlan({ principal: decimal("100000"), count: 1, annualRateEa: decimal("0.28"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    const free = buildInstallmentPlan({ principal: decimal("100000"), count: 6, annualRateEa: decimal("0.28"), method: "french", interestFree: true, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    expect(one.rows[0]?.interest.toString()).toBe("0");
    expect(free.rows.every((row) => row.interest.isZero())).toBe(true);
  });

  it("on-balance cards bill principal-only installments (D32)", () => {
    const plan = buildInstallmentPlan({ principal: decimal("451860"), count: 4, annualRateEa: decimal("0.28"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20", interestMode: "on_balance" });
    expect(plan.rows.every((row) => row.interest.isZero() && row.total.equals(row.principal))).toBe(true);
    expect(plan.totalInterest.isZero()).toBe(true);
    const perInstallment = buildInstallmentPlan({ principal: decimal("451860"), count: 4, annualRateEa: decimal("0.28"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20", interestMode: "per_installment" });
    expect(perInstallment.totalInterest.gt(0)).toBe(true);
  });

  it("reports installment progress from cutoffs already passed", () => {
    const plan = buildInstallmentPlan({ principal: decimal("120000"), count: 12, annualRateEa: decimal(0), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    const progress = installmentProgress(plan.rows, "2026-04-16");
    expect(progress.current).toBe(4);
    expect(progress.count).toBe(12);
    expect(progress.pendingPrincipal.toString()).toBe("90000");
  });

  it("rejects invalid inputs and currency/TRM combinations", () => {
    const input = { principal: decimal("100"), count: 2, annualRateEa: decimal(0), method: "fixed_principal" as const, interestFree: false, currency: "COP" as const, cutoffDay: 15, purchaseDate: "2026-01-20" };
    expect(() => buildInstallmentPlan({ ...input, principal: decimal(0) })).toThrow("capital");
    expect(() => buildInstallmentPlan({ ...input, count: 37 })).toThrow("cuotas");
    expect(() => buildInstallmentPlan({ ...input, annualRateEa: decimal(-1) })).toThrow("tasa");
    expect(() => buildInstallmentPlan({ ...input, fxRate: decimal(4000) })).toThrow("TRM");
    expect(() => buildInstallmentPlan({ ...input, currency: "USD" })).toThrow("TRM");
  });

  it("rechaza planes cuyo redondeo agotaría el capital antes de la última cuota", () => {
    expect(() => buildInstallmentPlan({ principal: decimal("0.02"), count: 4, annualRateEa: decimal("0"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" })).toThrow("muy pequeño");
  });
});

describe("compras en curso (R8, D31, D49)", () => {
  const base = { annualRateEa: decimal(0), method: "fixed_principal" as const, interestFree: false, currency: "COP" as const, cutoffDay: 15, purchaseDate: "2026-09-10" };
  const summary = (rows: ReturnType<typeof buildInstallmentPlan>["rows"]) => rows.map((row) => [row.number, row.principal.toFixed(2), row.interest.toFixed(2), row.balanceAfter.toFixed(2), row.cutoffDate, row.beforeTracking]);

  it("IKEA de la Visa: cuota 3 de 4 con el saldo del extracto mantiene el plan", () => {
    const plan = buildInstallmentPlan({ ...base, principal: decimal("451860"), count: 4, inProgress: { currentInstallment: 3, balanceAfter: decimal("112965"), trackedFromCutoff: "2026-11-15" } });
    expect(summary(plan.rows)).toEqual([
      [1, "112965.00", "0.00", "338895.00", null, true],
      [2, "112965.00", "0.00", "225930.00", null, true],
      [3, "112965.00", "0.00", "112965.00", "2026-11-15", false],
      [4, "112965.00", "0.00", "0.00", "2026-12-15", false],
    ]);
    expect(plan.priorInstallments).toBe(2);
    expect(plan.priorPrincipalPaid.toString()).toBe("225930");
    expect(plan.originalCount).toBeNull();
    expect(plan.firstInstallment.number).toBe(3);
  });

  it("avance de la Mastercard: con abono previo conserva la cuota y acorta el plan a 18", () => {
    const plan = buildInstallmentPlan({ ...base, purchaseDate: "2026-04-16", principal: decimal("600000"), count: 24, inProgress: { currentInstallment: 7, balanceAfter: decimal("269998.46"), trackedFromCutoff: "2026-11-15" } });
    expect(plan.rows).toHaveLength(18);
    expect(plan.originalCount).toBe(24);
    expect(plan.priorInstallments).toBe(6);
    expect(plan.priorPrincipalPaid.toString()).toBe("305001.54");
    expect(plan.rows.slice(0, 6).every((row) => row.beforeTracking && row.cutoffDate === null && row.interest.isZero())).toBe(true);
    expect(plan.rows[6]).toMatchObject({ number: 7, cutoffDate: "2026-11-15", beforeTracking: false });
    expect(plan.rows[6]?.principal.toString()).toBe("25000");
    expect(plan.rows[6]?.balanceAfter.toString()).toBe("269998.46");
    expect(plan.rows.at(-1)?.principal.toString()).toBe("19998.46");
    expect(plan.rows.at(-1)?.cutoffDate).toBe("2027-10-15");
    expect(plan.rows.reduce((sum, row) => sum.plus(row.principal), decimal(0)).toString()).toBe("600000");
  });

  it("GeoGuessr: centavos en COP dan una última cuota de $874,36 y el interés sale del saldo", () => {
    const plan = buildInstallmentPlan({ ...base, annualRateEa: decimal("0.2899"), principal: decimal("131904.26"), count: 36, inProgress: { currentInstallment: 10, balanceAfter: decimal("88810.60"), trackedFromCutoff: "2026-11-15" } });
    expect(plan.rows).toHaveLength(35);
    expect(plan.rows[9]?.principal.toString()).toBe("3664.01");
    expect(plan.rows[9]?.interest.toString()).toBe("1982.69");
    expect(plan.rows[9]?.balanceAfter.toString()).toBe("88810.6");
    expect(plan.rows.at(-1)?.principal.toString()).toBe("874.36");
    expect(plan.rows[0]?.principal.toString()).toBe("4381.07");
    expect(plan.rows[8]?.principal.toString()).toBe("4381.09");
    expect(plan.priorPrincipalPaid.toString()).toBe("39429.65");
    expect(plan.totalInterest.equals(plan.rows.slice(9).reduce((sum, row) => sum.plus(row.interest), decimal(0)))).toBe(true);
  });

  it("Fanova en USD: plan efectivo de 27 y equivalentes COP exactos", () => {
    const plan = buildInstallmentPlan({ ...base, currency: "USD", fxRate: decimal("4000"), principal: decimal("11.22"), count: 36, inProgress: { currentInstallment: 3, balanceAfter: decimal("7.33"), trackedFromCutoff: "2026-11-15" } });
    expect(plan.rows).toHaveLength(27);
    expect(plan.rows.at(-1)?.principal.toString()).toBe("0.2");
    expect(plan.priorPrincipalPaid.toString()).toBe("3.58");
    expect(plan.rows[0]?.principalCop.toString()).toBe("7160");
    expect(plan.rows.reduce((sum, row) => sum.plus(row.principalCop), decimal(0)).equals(plan.amountCop)).toBe(true);
    expect(plan.rows.slice(0, 2).every((row) => row.interestCop.isZero())).toBe(true);
  });

  it("un saldo del banco mayor al plan alarga el plan efectivo hasta 72", () => {
    const longer = buildInstallmentPlan({ ...base, principal: decimal("1200"), count: 12, inProgress: { currentInstallment: 3, balanceAfter: decimal("1050"), trackedFromCutoff: "2026-11-15" } });
    expect(longer.rows).toHaveLength(14);
    expect(longer.originalCount).toBe(12);
    expect(longer.rows.at(-1)?.principal.toString()).toBe("50");
    expect(() => buildInstallmentPlan({ ...base, principal: decimal("100"), count: 36, inProgress: { currentInstallment: 40, balanceAfter: decimal("97.22"), trackedFromCutoff: "2026-11-15" } })).toThrow("72");
  });

  it("sin saldo usa el plan original y acepta la diferencia de redondeo del banco", () => {
    const withoutBalance = buildInstallmentPlan({ ...base, principal: decimal("120000"), count: 12, inProgress: { currentInstallment: 4, trackedFromCutoff: "2026-11-15" } });
    expect(withoutBalance.priorPrincipalPaid.toString()).toBe("30000");
    expect(withoutBalance.rows).toHaveLength(12);
    const centOff = buildInstallmentPlan({ ...base, principal: decimal("120000"), count: 12, inProgress: { currentInstallment: 4, balanceAfter: decimal("80000.01"), trackedFromCutoff: "2026-11-15" } });
    expect(centOff.originalCount).toBeNull();
    expect(centOff.priorPrincipalPaid.toString()).toBe("30000");
    const last = buildInstallmentPlan({ ...base, principal: decimal("100"), count: 3, inProgress: { currentInstallment: 3, balanceAfter: decimal("0"), trackedFromCutoff: "2026-11-15" } });
    expect(last.originalCount).toBeNull();
    expect(last.priorPrincipalPaid.toString()).toBe("66.66");
    expect(last.rows.at(-1)?.principal.toString()).toBe("33.34");
  });

  it("cuota fija: las previas toman el capital del plan y no admiten saldo", () => {
    const plan = buildInstallmentPlan({ ...base, method: "french", annualRateEa: decimal("0.28"), principal: decimal("1000000"), count: 3, inProgress: { currentInstallment: 2, trackedFromCutoff: "2026-11-15" } });
    expect(plan.priorPrincipalPaid.toString()).toBe("326500.1");
    expect(plan.rows[0]).toMatchObject({ beforeTracking: true, cutoffDate: null });
    expect(plan.rows[0]?.interest.isZero()).toBe(true);
    expect(plan.rows[1]?.total.toString()).toBe("347284.83");
    expect(() => buildInstallmentPlan({ ...base, method: "french", principal: decimal("1000000"), count: 3, inProgress: { currentInstallment: 2, balanceAfter: decimal("600000"), trackedFromCutoff: "2026-11-15" } })).toThrow("capital fijo");
  });

  it("valida la cuota, el saldo y el extracto de la cuota k", () => {
    const input = { ...base, principal: decimal("1200"), count: 12 };
    const inProgress = { currentInstallment: 3, trackedFromCutoff: "2026-11-15" };
    expect(() => buildInstallmentPlan({ ...input, inProgress: { ...inProgress, currentInstallment: 1 } })).toThrow("cuota");
    expect(() => buildInstallmentPlan({ ...input, inProgress: { ...inProgress, currentInstallment: 13 } })).toThrow("cuota");
    expect(() => buildInstallmentPlan({ ...input, count: 1, inProgress })).toThrow("cuota");
    expect(() => buildInstallmentPlan({ ...input, inProgress: { ...inProgress, balanceAfter: decimal("-1") } })).toThrow("saldo");
    expect(() => buildInstallmentPlan({ ...input, inProgress: { ...inProgress, balanceAfter: decimal("1100.01") } })).toThrow("saldo");
    expect(() => buildInstallmentPlan({ ...input, inProgress: { ...inProgress, trackedFromCutoff: "2026-11-14" } })).toThrow("corte");
    expect(() => buildInstallmentPlan({ ...input, inProgress: { ...inProgress, trackedFromCutoff: "2026-08-15" } })).toThrow("corte");
    expect(() => buildInstallmentPlan({ ...input, principal: decimal("0.1"), count: 36, inProgress: { ...inProgress, balanceAfter: decimal("0.05") } })).toThrow("muy pequeño");
  });

  it("cuenta el progreso con las cuotas previas como pagadas y sobre el plan efectivo", () => {
    const plan = buildInstallmentPlan({ ...base, principal: decimal("451860"), count: 4, inProgress: { currentInstallment: 3, balanceAfter: decimal("112965"), trackedFromCutoff: "2026-11-15" } });
    expect(installmentProgress(plan.rows, "2026-11-17")).toMatchObject({ current: 4, count: 4 });
    expect(installmentProgress(plan.rows, "2026-11-17").pendingPrincipal.toString()).toBe("112965");
    expect(installmentProgress(plan.rows, "2026-11-15")).toMatchObject({ current: 3, count: 4 });
    expect(installmentProgress(plan.rows, "2026-11-15").pendingPrincipal.toString()).toBe("225930");
  });
});
