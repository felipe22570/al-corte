import Decimal from "decimal.js";
import { compareIsoDates, type IsoDate } from "./dates";
import { roundMoney, toCop, type Currency } from "./money";
import { monthlyRateFromEA } from "./rates";

/** D32: interest charged per installment (R2) or on the balance, in a single line per statement. */
export type InterestMode = "per_installment" | "on_balance";

/** An installment billed in the statement, with the data of its purchase or advance. */
export type BalanceInterestInstallment = {
  principal: Decimal; balanceAfter: Decimal; purchaseDate: IsoDate; rateEa: Decimal | null; interestFree: boolean;
  currency: Currency; fxRate: Decimal | null;
  /**
   * Share of the period the principal was pending, 1 when missing. A prepayment made during the period (R9) enters as
   * its own basis, with its amount as principal and the share of days before its date: the estimate prorates by days.
   */
  weight?: Decimal;
};

/**
 * R8 estimate for a single purchase or advance in a statement, rounded in its currency: pending principal at the start of
 * the period × its monthly rate. Zero for interest-free purchases, without rate, or made during the period itself.
 * Shared by the statement estimate and the cost of deferring (R11), so both add up.
 */
export function balanceInterestFor(installment: BalanceInterestInstallment, periodStart: IsoDate): Decimal {
  if (installment.interestFree || !installment.rateEa?.gt(0) || compareIsoDates(installment.purchaseDate, periodStart) >= 0) return new Decimal(0);
  const pending = installment.principal.plus(installment.balanceAfter).times(installment.weight ?? 1);
  return roundMoney(pending.times(monthlyRateFromEA(installment.rateEa)), installment.currency);
}

/**
 * R8 estimate, not stored: Σ pending principal at the start of the period × monthly rate of each purchase.
 * The pending principal is what remains after the previous statement, i.e. before the installment billed here.
 * Single-installment purchases have no installments; interest-free purchases and those made during the period are excluded.
 * It approximates the average daily balance banks use and is labelled "Intereses estimados".
 */
export function estimateBalanceInterest(installments: BalanceInterestInstallment[], periodStart: IsoDate) {
  const byCurrency: Record<Currency, Decimal> = { COP: new Decimal(0), USD: new Decimal(0) };
  const copByCurrency: Record<Currency, Decimal> = { COP: new Decimal(0), USD: new Decimal(0) };
  let amountCop = new Decimal(0);
  for (const installment of installments) {
    const interest = balanceInterestFor(installment, periodStart);
    if (interest.isZero()) continue;
    byCurrency[installment.currency] = byCurrency[installment.currency].plus(interest);
    const cop = toCop(interest, installment.currency, installment.fxRate ?? undefined);
    copByCurrency[installment.currency] = copByCurrency[installment.currency].plus(cop);
    amountCop = amountCop.plus(cop);
  }
  /** byCurrency is the estimate in each currency (D33); copByCurrency and amountCop are reference equivalents. */
  return { byCurrency, copByCurrency, amountCop };
}
