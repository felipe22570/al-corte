import Decimal from "decimal.js";

import type { IsoDate } from "./dates";
import type { Currency } from "./money";

/** Facts of a captured movement read by rules (R10). Never defined by AI. */
export type DraftFacts = { cardId: string | null; amount: string | null; currency: Currency | null; date: IsoDate | null };
export type DraftCandidate = { id: string; cardId: string; amount: string; currency: Currency; date: IsoDate; linked: boolean };

/**
 * D46: registered movements that look like the same purchase (same card, amount, currency and date) and are not linked
 * to another draft yet. The owner decides; nothing is merged automatically.
 */
export function sameMovementCandidates<T extends DraftCandidate>(draft: DraftFacts, candidates: readonly T[]): T[] {
  const { cardId, amount, currency, date } = draft;
  if (!cardId || !amount || !currency || !date) return [];
  return candidates.filter((candidate) => !candidate.linked && candidate.cardId === cardId && candidate.currency === currency
    && candidate.date === date && new Decimal(candidate.amount).equals(amount));
}

export type AmountChange = { charged: string; expected: string; currency: Currency };

/**
 * "DirecTV cobró $140.910; tu suscripción dice $83.350": the alert amount against the related subscription, only when both
 * are in the same currency. A subscription in another currency (billed in dollars, alert in pesos) is not comparable.
 */
export function subscriptionAmountChange(draft: Pick<DraftFacts, "amount" | "currency">, subscription: { amount: string; currency: Currency }): AmountChange | null {
  if (!draft.amount || draft.currency !== subscription.currency) return null;
  if (new Decimal(draft.amount).equals(subscription.amount)) return null;
  return { charged: draft.amount, expected: subscription.amount, currency: subscription.currency };
}
