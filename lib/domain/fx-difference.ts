import Decimal from "decimal.js";
import { roundMoney } from "./money";

const ZERO = new Decimal(0);

/** D56: the rate the bank used for a dollar payment, derived from the pesos debited, with 4 decimals. */
export function rateFromPesos(usd: Decimal, cop: Decimal): Decimal {
  return cop.div(usd).toDecimalPlaces(4, Decimal.ROUND_HALF_UP);
}

/**
 * Exchange difference of the dollars paid with pesos (R11, D56): pesos paid − dollars paid × (Σ COP equivalent ÷ Σ USD of
 * the dollar charges of the statement). Positive when the dollar cost more than the reference of each purchase. Null without
 * dollar charges to compare with.
 */
export function exchangeDifference(input: { paidUsd: Decimal; paidCop: Decimal; chargesUsd: Decimal; chargesCop: Decimal }): { reference: Decimal; difference: Decimal } | null {
  if (!input.chargesUsd.gt(0)) return null;
  const reference = roundMoney(input.paidUsd.times(input.chargesCop).div(input.chargesUsd), "COP");
  return { reference, difference: input.paidCop.minus(reference) };
}

/**
 * COP equivalent of the dollars of a statement once paid with pesos (D56): the pesos actually paid for the part paid and the
 * reference equivalent for what is still pending. A payment above the dollars of the statement (a total that also settles
 * future installments) only brings its proportional share of pesos.
 */
export function paidUsdEquivalent(input: { totalUsd: Decimal; referenceCop: Decimal; payments: Array<{ usd: Decimal; cop: Decimal }> }): Decimal {
  if (!input.totalUsd.gt(0)) return ZERO;
  const paidUsd = input.payments.reduce((total, payment) => total.plus(payment.usd), ZERO);
  const paidCop = input.payments.reduce((total, payment) => total.plus(payment.cop), ZERO);
  const covered = Decimal.min(paidUsd, input.totalUsd);
  const pesos = paidUsd.gt(0) ? paidCop.times(covered).div(paidUsd) : ZERO;
  const pending = input.totalUsd.minus(covered).times(input.referenceCop).div(input.totalUsd);
  return roundMoney(pesos.plus(pending), "COP");
}

/** D52: available credit with the pesos used plus the net debt in dollars at the given TRM, rounded to cents. */
export function availableCredit(input: { creditLimit: Decimal; copUsed: Decimal; usdNet: Decimal; trm: Decimal }): Decimal {
  return input.creditLimit.minus(input.copUsed).minus(roundMoney(input.usdNet.times(input.trm), "COP"));
}
