import Decimal from "decimal.js";
import { expect, it } from "vitest";
import { buildCashAdvance } from "@/lib/domain/advances";

it("uses the advance rate and assigns its fee to the first statement", () => {
  const result = buildCashAdvance({ amount: new Decimal("500000"), count: 2, card: { advanceRateEa: new Decimal("0.36"), advanceFee: new Decimal("15000"), amortizationMethod: "fixed_principal", cutoffDay: 15 }, date: "2026-01-20" });
  expect(result.advance.plan.monthlyRate.gt(0)).toBe(true);
  expect(result.fee.amount.toString()).toBe("15000");
  expect(result.fee.type).toBe("advance_fee");
  expect(result.fee.date).toBe("2026-01-20");
  expect(result.fee.cutoffDate).toBe("2026-02-15");
});
