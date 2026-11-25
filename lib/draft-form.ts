import Decimal from "decimal.js";

import type { IsoDate } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";
import { currencyEffects, type SuggestionField } from "@/lib/merchant-suggestion-form";
import { formatAmountInput } from "@/lib/money-input";
import type { DraftSuggestions } from "@/lib/validation/transaction-draft";
import type { TransactionInput, ValidTransaction } from "@/lib/validation/transaction";

export type DraftForForm = {
  cardId: string | null;
  type: TransactionInput["type"] | null;
  amount: string | null;
  currency: Currency | null;
  merchantRaw: string | null;
  occurredOn: IsoDate | null;
  suggestions: DraftSuggestions | null;
};

export type CapturedFormStart = {
  values: TransactionInput;
  /** Fields the merchant history (D53) must not change: the alert facts and what AI already suggested. */
  touched: SuggestionField[];
};

/**
 * Initial values of the expense form when confirming a captured draft (F18). Rules give card, type, amount, currency,
 * date and the merchant as it came; AI suggestions only fill name, category, installments and the international flag
 * (R10). The billing currency suggestion is shown as a hint and never changes the currency.
 */
export function draftFormStart(draft: DraftForForm, context: { cardIds: readonly string[]; categoryIds: readonly string[]; today: IsoDate; latestRate: string | null }): CapturedFormStart {
  const suggestion = draft.suggestions;
  const type = draft.type ?? "purchase";
  const allowsInstallments = type === "purchase" || type === "cash_advance";
  const currency = draft.currency ?? "COP";
  const touched: SuggestionField[] = ["currency", "fxRate"];
  const values: TransactionInput = {
    cardId: draft.cardId && context.cardIds.includes(draft.cardId) ? draft.cardId : "",
    type,
    date: draft.occurredOn ?? context.today,
    amount: draft.amount ? formatAmountInput(draft.amount) : "",
    currency,
    fxRate: currencyEffects(currency, context.latestRate).fxRate,
    installmentsCount: "1",
    interestFree: false,
    isInternational: currency === "USD" && allowsInstallments,
    advanceFee: "",
    categoryId: "",
    merchant: suggestion?.merchantName ?? draft.merchantRaw ?? "",
    note: "",
    inProgress: false,
    currentInstallment: "",
    balanceAfter: "",
    trackedFromCutoff: "",
  };
  if (suggestion?.categoryId && context.categoryIds.includes(suggestion.categoryId)) {
    values.categoryId = suggestion.categoryId;
    touched.push("categoryId");
  }
  if (allowsInstallments && suggestion?.installmentsCount) {
    values.installmentsCount = String(suggestion.installmentsCount);
    touched.push("installmentsCount");
  }
  if (allowsInstallments && suggestion?.isInternational !== null && suggestion?.isInternational !== undefined) {
    values.isInternational = suggestion.isInternational;
    touched.push("isInternational");
  }
  return { values, touched };
}

/** What the capture can propose, in the order they are stored (step 45). Names only, never values (D47). */
export const CAPTURED_FIELDS = ["card", "type", "date", "amount", "currency", "merchant", "category", "installments", "international"] as const;
export type CapturedField = (typeof CAPTURED_FIELDS)[number];

type ConfirmedValues = Pick<ValidTransaction, "cardId" | "type" | "date" | "amount" | "currency" | "merchant" | "categoryId" | "installmentsCount" | "isInternational">;

/**
 * Fields the owner corrected when confirming a captured draft: only those the alert facts or the AI suggestions filled.
 * Completing an empty field (a category the AI did not suggest) is not a correction. Measures "confirmed without
 * changes" in the H12 validation without keeping any value of the email.
 */
export function capturedChanges(draft: DraftForForm, confirmed: ConfirmedValues): CapturedField[] {
  const suggestion = draft.suggestions;
  const proposedMerchant = suggestion?.merchantName ?? draft.merchantRaw;
  const differs: Record<CapturedField, boolean> = {
    card: draft.cardId !== null && draft.cardId !== confirmed.cardId,
    type: draft.type !== null && draft.type !== confirmed.type,
    date: draft.occurredOn !== null && draft.occurredOn !== confirmed.date,
    amount: draft.amount !== null && !new Decimal(draft.amount).eq(confirmed.amount),
    currency: draft.currency !== null && draft.currency !== confirmed.currency,
    merchant: proposedMerchant !== null && proposedMerchant.trim() !== confirmed.merchant.trim(),
    category: Boolean(suggestion?.categoryId) && suggestion!.categoryId !== confirmed.categoryId,
    installments: Boolean(suggestion?.installmentsCount) && suggestion!.installmentsCount !== confirmed.installmentsCount,
    international: suggestion?.isInternational !== null && suggestion?.isInternational !== undefined && suggestion.isInternational !== confirmed.isInternational,
  };
  return CAPTURED_FIELDS.filter((field) => differs[field]);
}
