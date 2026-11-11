import Decimal from "decimal.js";
import { buildInstallmentPlan, type AmortizationMethod } from "./installments";
import { toCop, type Currency } from "./money";
import { dueDateFor, statementCutoffFor } from "./statements";
import type { IsoDate } from "./dates";

export type TransactionPlanInput = {
  cardId: string; type: "purchase" | "cash_advance" | "payment" | "handling_fee" | "interest" | "insurance" | "refund" | "adjustment";
  date: IsoDate; amount: string; currency: Currency; fxRate?: string | null; installmentsCount: number;
  interestFree: boolean; categoryId: string | null; merchant: string; note: string;
};
export type TransactionCard = { id: string; cutoffDay: number; paymentDay: number; purchaseRateEa: string; advanceRateEa: string; advanceFee: string; amortizationMethod: AmortizationMethod };

export function buildTransactionPlan(input: TransactionPlanInput, card: TransactionCard, original?: { cardId: string; type: TransactionPlanInput["type"]; rateEaApplied: string | null }) {
  if (input.cardId !== card.id) throw new Error("La tarjeta no coincide con el movimiento.");
  const principal = new Decimal(input.amount);
  const fxRate = input.fxRate ? new Decimal(input.fxRate) : undefined;
  const amountCop = toCop(principal, input.currency, fxRate);
  const isPurchase = input.type === "purchase";
  const isAdvance = input.type === "cash_advance";
  const currentRate = isAdvance ? card.advanceRateEa : card.purchaseRateEa;
  const rate = original?.cardId === input.cardId && original.type === input.type ? original.rateEaApplied ?? currentRate : currentRate;
  const firstCutoff = statementCutoffFor(card.cutoffDay, input.date);
  const plan = buildInstallmentPlan({ principal, count: input.installmentsCount, annualRateEa: new Decimal(isPurchase || isAdvance ? rate : "0"), method: card.amortizationMethod, interestFree: input.interestFree, currency: input.currency, fxRate, cutoffDay: card.cutoffDay, purchaseDate: input.date });
  const installments = input.installmentsCount > 1 ? plan.rows.map((row) => ({ number: row.number, cutoff_date: row.cutoffDate, principal: row.principal.toFixed(), interest: row.interest.toFixed(), total: row.total.toFixed(), balance_after: row.balanceAfter.toFixed(), principal_cop: row.principalCop.toFixed(), interest_cop: row.interestCop.toFixed(), total_cop: row.totalCop.toFixed() })) : [];
  return {
    firstCutoff,
    dueDate: dueDateFor(card.paymentDay, firstCutoff),
    firstInstallment: plan.firstInstallment.total.toFixed(),
    firstInstallmentCop: plan.firstInstallment.totalCop.toFixed(),
    totalInterest: plan.totalInterest.toFixed(),
    advanceFee: isAdvance ? new Decimal(card.advanceFee).toFixed() : "0",
    payload: {
      card_id: card.id, type: input.type, date: input.date, amount: principal.toFixed(), currency: input.currency,
      fx_rate: fxRate?.toFixed() ?? null, amount_cop: amountCop.toFixed(), installments_count: input.installmentsCount,
      interest_free: input.interestFree, category_id: input.categoryId, merchant: input.merchant, note: input.note,
      rate_ea_applied: isPurchase || isAdvance ? rate : null, installments,
    },
  };
}
