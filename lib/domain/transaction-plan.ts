import Decimal from "decimal.js";
import { buildInstallmentPlan, type AmortizationMethod } from "./installments";
import type { InterestMode } from "./interest";
import { toCop, type Currency } from "./money";
import { dueDateFor, statementCutoffFor } from "./statements";
import type { IsoDate } from "./dates";

/** In-progress purchase data copied from the last bank statement (D49). */
export type TransactionInProgress = { currentInstallment: number; balanceAfter: string | null; trackedFromCutoff: IsoDate };
export type TransactionPlanInput = {
  cardId: string; type: "purchase" | "cash_advance" | "payment" | "handling_fee" | "interest" | "insurance" | "refund" | "adjustment";
  date: IsoDate; amount: string; currency: Currency; fxRate?: string | null; installmentsCount: number;
  interestFree: boolean; categoryId: string | null; merchant: string; note: string;
  /** R9: international purchase or advance; true by default in USD. */
  isInternational?: boolean;
  /** D41: fee of this advance; the card's is only the default. */
  advanceFee?: string | null;
  inProgress?: TransactionInProgress | null;
};
export type TransactionCard = { id: string; cutoffDay: number; paymentDay: number; purchaseRateEa: string; advanceRateEa: string; advanceFee: string; amortizationMethod: AmortizationMethod; interestMode?: InterestMode };

export function buildTransactionPlan(input: TransactionPlanInput, card: TransactionCard, original?: { cardId: string; type: TransactionPlanInput["type"]; rateEaApplied: string | null }) {
  if (input.cardId !== card.id) throw new Error("La tarjeta no coincide con el movimiento.");
  const principal = new Decimal(input.amount);
  const fxRate = input.fxRate ? new Decimal(input.fxRate) : undefined;
  const amountCop = toCop(principal, input.currency, fxRate);
  const isPurchase = input.type === "purchase";
  const isAdvance = input.type === "cash_advance";
  const currentRate = isAdvance ? card.advanceRateEa : card.purchaseRateEa;
  const rate = original?.cardId === input.cardId && original.type === input.type ? original.rateEaApplied ?? currentRate : currentRate;
  const inProgress = input.inProgress ?? null;
  // D41: each advance keeps its own fee, the card's by default. An in-progress advance already paid it before tracking.
  const advanceFee = isAdvance && !inProgress ? new Decimal(input.advanceFee ?? card.advanceFee).toFixed() : "0";
  const plan = buildInstallmentPlan({
    principal, count: input.installmentsCount, annualRateEa: new Decimal(isPurchase || isAdvance ? rate : "0"), method: card.amortizationMethod,
    interestFree: input.interestFree, currency: input.currency, fxRate, cutoffDay: card.cutoffDay, purchaseDate: input.date, interestMode: card.interestMode,
    inProgress: inProgress && { currentInstallment: inProgress.currentInstallment, balanceAfter: inProgress.balanceAfter === null ? null : new Decimal(inProgress.balanceAfter), trackedFromCutoff: inProgress.trackedFromCutoff },
  });
  // With prior installments, the movement belongs to the statement of installment k, not to the one R1 gives its date.
  const firstCutoff = inProgress?.trackedFromCutoff ?? statementCutoffFor(card.cutoffDay, input.date);
  const installments = plan.rows.length > 1 ? plan.rows.map((row) => ({ number: row.number, cutoff_date: row.cutoffDate, before_tracking: row.beforeTracking, principal: row.principal.toFixed(), interest: row.interest.toFixed(), total: row.total.toFixed(), balance_after: row.balanceAfter.toFixed(), principal_cop: row.principalCop.toFixed(), interest_cop: row.interestCop.toFixed(), total_cop: row.totalCop.toFixed() })) : [];
  return {
    firstCutoff,
    dueDate: dueDateFor(card.paymentDay, firstCutoff),
    firstInstallment: plan.firstInstallment.total.toFixed(),
    firstInstallmentCop: plan.firstInstallment.totalCop.toFixed(),
    totalInterest: plan.totalInterest.toFixed(),
    advanceFee,
    payload: {
      card_id: card.id, type: input.type, date: input.date, amount: principal.toFixed(), currency: input.currency,
      fx_rate: fxRate?.toFixed() ?? null, amount_cop: amountCop.toFixed(), installments_count: plan.rows.length,
      interest_free: input.interestFree, category_id: input.categoryId, merchant: input.merchant, note: input.note,
      rate_ea_applied: isPurchase || isAdvance ? rate : null, installments,
      prior_installments: plan.priorInstallments, prior_principal_paid: plan.priorPrincipalPaid.toFixed(),
      original_installments_count: plan.originalCount, tracked_from_cutoff: inProgress?.trackedFromCutoff ?? null,
      is_international: (isPurchase || isAdvance) && (input.isInternational ?? input.currency === "USD"),
      advance_fee: advanceFee,
    },
  };
}
