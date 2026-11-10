import Decimal from "decimal.js";
import { buildInstallmentPlan, type AmortizationMethod } from "./installments";
import { statementCutoffFor } from "./statements";
import { type IsoDate } from "./dates";

export function buildCashAdvance(input: { amount: Decimal; count: number; card: { advanceRateEa: Decimal; advanceFee: Decimal; amortizationMethod: AmortizationMethod; cutoffDay: number }; date: IsoDate }) {
  const plan = buildInstallmentPlan({ principal: input.amount, count: input.count, annualRateEa: input.card.advanceRateEa, method: input.card.amortizationMethod, interestFree: false, currency: "COP", cutoffDay: input.card.cutoffDay, purchaseDate: input.date });
  return { advance: { plan }, fee: { amount: input.card.advanceFee, type: "advance_fee" as const, date: input.date, cutoffDate: statementCutoffFor(input.card.cutoffDay, input.date) } };
}
