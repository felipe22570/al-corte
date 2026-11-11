import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { buildInstallmentPlan, installmentProgress } from "@/lib/domain/installments";

const decimal = (value: string | number) => new Decimal(value);

describe("installments", () => {
  it("builds the COP fixed-principal reference plan", () => {
    const plan = buildInstallmentPlan({ principal: decimal("1000000"), count: 3, annualRateEa: decimal("0.28"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    expect(plan.rows.map(({ principal, interest, total, balanceAfter }) => [principal.toString(), interest.toString(), total.toString(), balanceAfter.toString()])).toEqual([
      ["333333", "20785", "354118", "666667"], ["333333", "13856", "347189", "333334"], ["333334", "6928", "340262", "0"],
    ]);
    expect(plan.rows.map((row) => row.cutoffDate)).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
  });

  it("builds French installments and makes the final balance exact", () => {
    const plan = buildInstallmentPlan({ principal: decimal("1000000"), count: 3, annualRateEa: decimal("0.28"), method: "french", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" });
    expect(plan.rows.map((row) => row.total.toString())).toEqual(["347285", "347285", "347285"]);
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
    expect(() => buildInstallmentPlan({ principal: decimal("2"), count: 4, annualRateEa: decimal("0"), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-01-20" })).toThrow("muy pequeño");
  });
});
