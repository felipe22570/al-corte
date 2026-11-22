import Decimal from "decimal.js";
import { compareIsoDates, type IsoDate } from "./dates";
import { balanceInterestFor, type InterestMode } from "./interest";
import { roundMoney, type Currency } from "./money";
import { prepaymentInterestWeight } from "./payments";
import { periodStartFor, statementCutoffFor } from "./statements";

/** An installment of the plan, as stored or as the form previews it. Rows paid before tracking never count (D31). */
export type DeferralRow = { cutoffDate: IsoDate | null; beforeTracking: boolean; principal: Decimal; interest: Decimal; balanceAfter: Decimal };

/** A purchase or advance with its installments and the terms that decide its interest (R2, R8). */
export type DeferralPurchase = {
  amount: Decimal; currency: Currency; fxRate: Decimal | null; purchaseDate: IsoDate; rateEa: Decimal | null; interestFree: boolean;
  interestMode: InterestMode; cutoffDay: number;
  /** Installments of the effective plan; a single-installment purchase never accrues interest (R2, R8). */
  installmentsCount: number;
  /** Installment rows; they may be only part of the plan, such as the statements still to come. */
  rows: DeferralRow[];
  /** On-balance prepayments made during a statement period (R9): weighted by the days before their date, as the months do. */
  prepayments?: Array<{ cutoffDate: IsoDate; date: IsoDate; amount: Decimal }>;
};

export type InterestByStatement = { cutoffDate: IsoDate; interest: Decimal };

const ZERO = new Decimal(0);
/** Interest above this share of the value triggers the alert in the form (F21). */
export const DEFERRAL_ALERT_SHARE = new Decimal("0.2");
const sum = (entries: InterestByStatement[]) => entries.reduce((total, entry) => total.plus(entry.interest), ZERO);

/**
 * Interest of the purchase per statement, with the rule the app already uses (R11): the interest of each installment in
 * `per_installment` (R2), or the R8 estimate of each statement in `on_balance`, which charges nothing in the statement of
 * the period of the purchase. Interest-free or single-installment purchases give nothing.
 */
export function interestSchedule(purchase: DeferralPurchase): InterestByStatement[] {
  if (purchase.installmentsCount <= 1 || purchase.interestFree) return [];
  const tracked = purchase.rows.filter((row) => !row.beforeTracking && row.cutoffDate !== null);
  if (purchase.interestMode === "per_installment") return tracked.map((row) => ({ cutoffDate: row.cutoffDate!, interest: row.interest }));
  const basis = { purchaseDate: purchase.purchaseDate, rateEa: purchase.rateEa, interestFree: false, currency: purchase.currency, fxRate: purchase.fxRate };
  const byCutoff = new Map<IsoDate, Decimal>();
  for (const row of tracked) {
    const periodStart = periodStartFor(purchase.cutoffDay, row.cutoffDate!);
    byCutoff.set(row.cutoffDate!, (byCutoff.get(row.cutoffDate!) ?? ZERO).plus(balanceInterestFor({ ...basis, principal: row.principal, balanceAfter: row.balanceAfter }, periodStart)));
  }
  for (const prepayment of purchase.prepayments ?? []) {
    const periodStart = periodStartFor(purchase.cutoffDay, prepayment.cutoffDate);
    const weight = prepaymentInterestWeight(periodStart, prepayment.cutoffDate, prepayment.date);
    byCutoff.set(prepayment.cutoffDate, (byCutoff.get(prepayment.cutoffDate) ?? ZERO).plus(balanceInterestFor({ ...basis, principal: prepayment.amount, balanceAfter: ZERO, weight }, periodStart)));
  }
  return [...byCutoff].map(([cutoffDate, interest]) => ({ cutoffDate, interest })).sort((first, second) => compareIsoDates(first.cutoffDate, second.cutoffDate));
}

/** Estimated interest of the whole plan, in the purchase currency (R11). In-progress purchases count from the installment registered. */
export function estimatedInterest(purchase: DeferralPurchase): Decimal {
  return sum(interestSchedule(purchase));
}

/**
 * Cost of deferring for the purchase detail: interest of statements already cut (a statement cutting today is still open,
 * R7) and still to come, the share over the value and, in dollars, the COP reference with the purchase TRM.
 */
export function deferralCostSummary(purchase: DeferralPurchase, today: IsoDate) {
  const schedule = interestSchedule(purchase);
  const accrued = sum(schedule.filter((entry) => compareIsoDates(entry.cutoffDate, today) < 0));
  const total = sum(schedule);
  const pending = total.minus(accrued);
  const toCop = (value: Decimal) => roundMoney(value.times(purchase.fxRate!), "COP");
  return {
    accrued, pending, total,
    percent: total.div(purchase.amount),
    exceedsThreshold: total.gt(purchase.amount.times(DEFERRAL_ALERT_SHARE)),
    copReference: purchase.currency === "USD" && purchase.fxRate ? { accrued: toCop(accrued), pending: toCop(pending), total: toCop(total) } : null,
  };
}

/**
 * Interest avoided by paying the total debt of a statement in one currency (R11, D54): the estimated interest of the
 * statements after the period open today, whose interest is already accruing, for purchases made up to its cutoff.
 */
export function payInFullSavings(purchases: DeferralPurchase[], options: { currency: Currency; statementCutoff: IsoDate; today: IsoDate }): Decimal {
  return purchases
    .filter((purchase) => purchase.currency === options.currency && compareIsoDates(purchase.purchaseDate, options.statementCutoff) <= 0)
    .reduce((total, purchase) => {
      const openCutoff = statementCutoffFor(purchase.cutoffDay, options.today);
      return total.plus(sum(interestSchedule(purchase).filter((entry) => compareIsoDates(entry.cutoffDate, openCutoff) > 0)));
    }, ZERO);
}
