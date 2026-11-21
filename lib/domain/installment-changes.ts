import Decimal from "decimal.js";
import type { IsoDate } from "./dates";
import { amortize, MAX_NEW_INSTALLMENTS, MAX_PLAN_INSTALLMENTS, type InstallmentRow } from "./installments";
import { roundMoney } from "./money";
import { installmentRowPayload, isBilledAt, pendingAt, rebuildRows, type PaymentTarget } from "./payments";

const ZERO = new Decimal(0);
const sum = (values: Decimal[]) => values.reduce((total, value) => total.plus(value), ZERO);

/**
 * Interest a plan would accrue, month by month, on the balance before each installment. For installments with interest
 * (R2) it is their interest; for on-balance cards (D32) it estimates the interest charges the plan generates.
 */
export function planInterest(rows: Array<Pick<InstallmentRow, "principal" | "balanceAfter">>, monthlyRate: Decimal, currency: PaymentTarget["currency"]): Decimal {
  return sum(rows.map((row) => roundMoney(row.principal.plus(row.balanceAfter).times(monthlyRate), currency)));
}

/**
 * F16, D40, D50: new number of installments left (1 to 36) on the pending balance, from the next unbilled installment.
 * Billed and previous installments stay; the rest is rebuilt with the card's method and the purchase's frozen rate, in
 * the same statements and then the following ones. The effective plan may reach 72 installments.
 * `interestRate` is the purchase's monthly rate, also for on-balance cards, to compare the estimated interest.
 */
export function changeInstallments(input: { target: PaymentTarget; remaining: number; date: IsoDate; cutoffDay: number; interestRate: Decimal }) {
  const { target, remaining, date } = input;
  const { terms } = target;
  if (!Number.isInteger(remaining) || remaining < 1 || remaining > MAX_NEW_INSTALLMENTS) throw new Error(`Elige entre 1 y ${MAX_NEW_INSTALLMENTS} cuotas restantes.`);
  const firstFuture = target.rows.findIndex((row) => !isBilledAt(row, date));
  if (firstFuture < 0) throw new Error("Esta compra ya no tiene cuotas por facturar.");
  const kept = target.rows.slice(0, firstFuture);
  const future = target.rows.slice(firstFuture);
  if (kept.length + remaining > MAX_PLAN_INSTALLMENTS) throw new Error(`El plan no puede superar ${MAX_PLAN_INSTALLMENTS} cuotas. Elige menos cuotas restantes.`);
  const pending = pendingAt(target, date);
  const items = amortize(pending, remaining, terms.monthlyRate, terms.method, terms.currency);
  const coveredCop = sum(kept.map((row) => row.principalCop)).plus(sum(target.prepayments.map((item) => item.amountCop)));
  const rows = rebuildRows({ terms, kept, future, items, balance: pending, coveredCop, cutoffDay: input.cutoffDay, lastCutoff: future.at(-1)!.cutoffDate! });
  const interestBefore = planInterest(future, input.interestRate, terms.currency);
  const interestAfter = planInterest(rows, input.interestRate, terms.currency);
  return {
    pending, rows, replacedFromNumber: firstFuture + 1, effectivePlan: kept.length + remaining, nextInstallment: rows[0]!.total,
    previousInstallment: future[0]!.total, interestBefore, interestAfter, interestDifference: interestAfter.minus(interestBefore),
  };
}

/** Payload of `change_installments`. */
export function installmentChangePayload(transactionId: string, remaining: number, change: ReturnType<typeof changeInstallments>) {
  return { transaction_id: transactionId, remaining_installments: remaining, replaced_from_number: change.replacedFromNumber, installments: change.rows.map(installmentRowPayload) };
}
