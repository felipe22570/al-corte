import Decimal from "decimal.js";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInstallmentPlan, type AmortizationMethod } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import fixture from "./fixtures/installment-parity.json";
import { parityTestSql } from "../../../scripts/generate-installment-parity-test.mjs";

describe("paridad del plan de cuotas con SQL (paso 31)", () => {
  it.each(fixture)("$name", (input) => {
    const plan = buildInstallmentPlan({
      principal: new Decimal(input.amount), count: input.count, annualRateEa: new Decimal(input.rateEa), method: input.method as AmortizationMethod,
      interestFree: input.interestFree, currency: input.currency as "COP" | "USD", fxRate: input.fxRate ? new Decimal(input.fxRate) : undefined,
      cutoffDay: input.cutoffDay, purchaseDate: input.date, interestMode: input.interestMode as InterestMode,
    });
    expect(plan.rows.map((row) => ({ number: row.number, cutoffDate: row.cutoffDate, principal: row.principal.toFixed(2), interest: row.interest.toFixed(2), total: row.total.toFixed(2), balanceAfter: row.balanceAfter.toFixed(2), principalCop: row.principalCop.toFixed(2), interestCop: row.interestCop.toFixed(2), totalCop: row.totalCop.toFixed(2) }))).toEqual(input.rows);
  });

  it("la prueba pgTAP usa el mismo fixture (regenerar con scripts/generate-installment-parity-test.mjs)", () => {
    expect(readFileSync("supabase/tests/120-installment-parity.test.sql", "utf8")).toBe(parityTestSql(fixture));
  });
});
