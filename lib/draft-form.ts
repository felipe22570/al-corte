import type { IsoDate } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";
import { currencyEffects, type SuggestionField } from "@/lib/merchant-suggestion-form";
import { formatAmountInput } from "@/lib/money-input";
import type { DraftSuggestions } from "@/lib/validation/transaction-draft";
import type { TransactionInput } from "@/lib/validation/transaction";

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
