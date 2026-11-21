import Decimal from "decimal.js";
import { bankDifference, statementPaidAt } from "./balances";
import { compareIsoDates, type IsoDate } from "./dates";
import { MAX_PLAN_INSTALLMENTS, type InstallmentRow } from "./installments";
import { roundMoney, type Currency } from "./money";
import { installmentRowPayload, reduceTermSchedule, type PaymentTarget } from "./payments";
import { shiftStatement } from "./statements";

const ZERO = new Decimal(0);
const sum = (values: Decimal[]) => values.reduce((total, value) => total.plus(value), ZERO);

/**
 * Rate in force as the bank prints it (D39). A monthly rate converts with (1 + i)^12 − 1; the card stores E.A. with
 * 6 decimals, enough to give back the bank's monthly rate with 4 decimals of a percent.
 */
export function effectiveAnnualRate(value: Decimal, unit: "ea" | "mv"): Decimal {
  const annual = unit === "ea" ? value : new Decimal(1).plus(value).pow(12).minus(1);
  return annual.toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

export type CloseConcept = "minimum" | "debt" | "interest";
type Amounts = Record<CloseConcept, Decimal | null>;

/**
 * F15: the app's calculation against the bank, per concept. The difference is null within the bank's rounding (R8)
 * or when the bank value is missing. Bank interest is the regular plus the late interest.
 */
export function closeComparison(calculated: Record<CloseConcept, Decimal>, bank: Amounts) {
  return (["minimum", "debt", "interest"] as const).map((concept) => ({
    concept, calculated: calculated[concept], bank: bank[concept], difference: bankDifference(calculated[concept], bank[concept]),
  }));
}

/** Bank interest of a statement: regular plus late interest; null when neither is known. */
export function bankInterest(regular: Decimal | null, late: Decimal | null): Decimal | null {
  return regular === null && late === null ? null : (regular ?? ZERO).plus(late ?? ZERO);
}

function isBilledBy(row: Pick<InstallmentRow, "beforeTracking" | "cutoffDate">, cutoff: IsoDate) {
  return row.beforeTracking || compareIsoDates(row.cutoffDate!, cutoff) <= 0;
}
function effectiveBy(item: { date?: IsoDate }, cutoff: IsoDate) {
  return item.date === undefined || compareIsoDates(item.date, cutoff) <= 0;
}

/**
 * D39: balance of a purchase after a statement as Al Corte computes it, the figure the bank prints next to each purchase:
 * value minus installments billed up to the cutoff and prepayments or corrections in effect by then.
 */
export function balanceAfterStatement(target: Pick<PaymentTarget, "terms" | "rows" | "prepayments">, statementCutoff: IsoDate): Decimal {
  return target.terms.amount
    .minus(sum(target.rows.filter((row) => isBilledBy(row, statementCutoff)).map((row) => row.principal)))
    .minus(sum(target.prepayments.filter((item) => effectiveBy(item, statementCutoff)).map((item) => item.amount)));
}

/**
 * D39 with D31: the bank's balance prevails. The unbilled installments are rebuilt from it with the same installment
 * (fewer when the bank balance is lower, more when higher), in the same statements and then the following ones.
 * Prepayments made after the cutoff are not in the bank balance yet and still apply. The correction is signed and keeps
 * Σ principal + Σ prepayments and corrections = amount, also in COP. Null when the bank agrees within its rounding (R8).
 */
export function buildBalanceCorrection(input: { target: PaymentTarget; statementCutoff: IsoDate; bankBalance: Decimal; cutoffDay: number }) {
  const { target, statementCutoff, bankBalance, cutoffDay } = input;
  const { terms } = target;
  const calculated = balanceAfterStatement(target, statementCutoff);
  if (bankDifference(calculated, bankBalance) === null) return null;
  const amount = calculated.minus(bankBalance);
  const later = sum(target.prepayments.filter((item) => !effectiveBy(item, statementCutoff)).map((item) => item.amount));
  const remaining = bankBalance.minus(later);
  if (remaining.isNegative()) throw new Error("El saldo del banco es menor que los abonos registrados después del corte.");
  const firstFuture = target.rows.findIndex((row) => !isBilledBy(row, statementCutoff));
  const kept = firstFuture < 0 ? target.rows : target.rows.slice(0, firstFuture);
  const future = firstFuture < 0 ? [] : target.rows.slice(firstFuture);
  // "Same installment" (D31): the one the bank is billing now, or the last billed when none is left.
  const regular = future[0] ?? kept.at(-1)!;
  const maxCount = MAX_PLAN_INSTALLMENTS - kept.length;
  const items = remaining.isZero() ? [] : reduceTermSchedule(remaining, regular, maxCount + 1, terms.monthlyRate, terms.method, terms.currency);
  if (items.length > maxCount) throw new Error(`Con ese saldo el plan pasaría de ${MAX_PLAN_INSTALLMENTS} cuotas. Revisa el valor.`);
  const copOf = (value: Decimal) => terms.currency === "COP" ? value : roundMoney(value.times(terms.fxRate!), "COP");
  const coveredCop = sum(kept.map((row) => row.principalCop)).plus(sum(target.prepayments.map((item) => item.amountCop)));
  const amountCop = items.length ? copOf(amount) : terms.amountCop.minus(coveredCop);
  let copSoFar = coveredCop.plus(amountCop);
  let balance = remaining;
  let cutoff = future.at(-1)?.cutoffDate ?? statementCutoff;
  const rows: InstallmentRow[] = items.map((item, index) => {
    balance = balance.minus(item.principal);
    if (index >= future.length) cutoff = shiftStatement(cutoffDay, cutoff!, 1);
    const principalCop = index === items.length - 1 ? terms.amountCop.minus(copSoFar) : copOf(item.principal);
    copSoFar = copSoFar.plus(principalCop);
    const interestCop = copOf(item.interest);
    return {
      number: kept.length + index + 1, principal: item.principal, interest: item.interest, total: item.principal.plus(item.interest), balanceAfter: balance,
      cutoffDate: index < future.length ? future[index]!.cutoffDate : cutoff, beforeTracking: false, principalCop, interestCop, totalCop: principalCop.plus(interestCop),
    };
  });
  return { calculated, amount, amountCop, rows, replacedFromNumber: kept.length + 1 };
}

/** A statement is reconciled when every currency with charges is (D39), like the payment mark (D33). */
export function statementReconciledAt(reconciledAt: Partial<Record<Currency, string | null>>, currencies: Currency[]): string | null {
  return statementPaidAt(reconciledAt, currencies);
}

/**
 * F15 notice: for each active card, its latest statement already cut when it is not reconciled. Earlier statements
 * never ask for a close.
 */
export function statementsToReview<T extends { cardId: string; cutoffDate: IsoDate; reconciledAt: string | null }>(cards: Array<{ id: string; archived: boolean }>, statements: T[], today: IsoDate): T[] {
  return cards.filter((card) => !card.archived).flatMap((card) => {
    const latest = statements.filter((statement) => statement.cardId === card.id && compareIsoDates(statement.cutoffDate, today) < 0)
      .reduce<T | null>((last, statement) => !last || compareIsoDates(statement.cutoffDate, last.cutoffDate) > 0 ? statement : last, null);
    return latest && !latest.reconciledAt ? [latest] : [];
  });
}

/**
 * D39: corrections of the purchases whose bank balance was entered in the close. A balance that agrees with the
 * calculation, or a cleared one, removes the previous correction of the statement; the database restores its rows first.
 */
export function planBalanceCorrections(input: {
  purchases: Array<{ id: string; target: PaymentTarget; bankBalance: Decimal | null }>;
  entered: Map<string, Decimal | null>; statementCutoff: IsoDate; cutoffDay: number;
}) {
  const corrections: Array<Record<string, unknown>> = [];
  const remove: string[] = [];
  for (const purchase of input.purchases) {
    if (!input.entered.has(purchase.id)) continue;
    const bankBalance = input.entered.get(purchase.id)!;
    const correction = bankBalance && buildBalanceCorrection({ target: purchase.target, statementCutoff: input.statementCutoff, bankBalance, cutoffDay: input.cutoffDay });
    if (!correction) {
      if (purchase.bankBalance !== null) remove.push(purchase.id);
      continue;
    }
    corrections.push({
      transaction_id: purchase.id, bank_balance: bankBalance.toFixed(), amount: correction.amount.toFixed(), amount_cop: correction.amountCop.toFixed(),
      replaced_from_number: correction.replacedFromNumber, installments: correction.rows.map(installmentRowPayload),
    });
  }
  return { corrections, remove };
}
