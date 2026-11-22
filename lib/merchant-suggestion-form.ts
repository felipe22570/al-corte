import type { IsoDate } from "@/lib/domain/dates";
import type { MerchantHistoryRow } from "@/lib/domain/merchant-suggestions";
import { formatDateShort } from "@/lib/format";
import type { TransactionInput } from "@/lib/validation/transaction";

/** Transaction form fields a merchant suggestion may fill (R11, D53). Never amount, date or card. */
export type SuggestionField = "categoryId" | "currency" | "fxRate" | "installmentsCount" | "isInternational" | "interestFree";
export type SuggestionPatch = Partial<{ categoryId: string; currency: "COP" | "USD"; fxRate: string; installmentsCount: string; isInternational: boolean; interestFree: boolean }>;
type Touched = ReadonlySet<SuggestionField>;

/** What choosing a currency also sets in the form: the latest TRM (D4) and the international flag. */
export function currencyEffects(currency: "COP" | "USD", latestRate: string | null): { fxRate: string; isInternational: boolean } {
  return { fxRate: currency === "USD" ? (latestRate ?? "").replace(".", ",") : "", isInternational: currency === "USD" };
}

function current(values: TransactionInput, field: SuggestionField): string | boolean {
  const value = values[field];
  return field === "installmentsCount" ? String(value) : (value as string | boolean | undefined) ?? false;
}

/**
 * Fills only the fields the owner has not touched, with the same side effects as changing them by hand.
 * The suggested installments replace the USD default (D34), which is never marked as touched.
 * Returns the changes and the previous value of each changed field, to undo the suggestion.
 */
export function applySuggestion(values: TransactionInput, suggestion: MerchantHistoryRow, touched: Touched, context: { latestRate: string | null; categoryIds: readonly string[] }): { patch: SuggestionPatch; previous: SuggestionPatch } {
  const candidate: SuggestionPatch = {};
  const free = (field: SuggestionField) => !touched.has(field);
  if (free("categoryId") && (suggestion.categoryId === null || context.categoryIds.includes(suggestion.categoryId))) candidate.categoryId = suggestion.categoryId ?? "";
  let currency = values.currency;
  if (free("currency") && suggestion.currency !== values.currency) {
    currency = suggestion.currency;
    candidate.currency = currency;
    const effects = currencyEffects(currency, context.latestRate);
    if (free("fxRate")) candidate.fxRate = effects.fxRate;
    if (free("isInternational")) candidate.isInternational = effects.isInternational;
  }
  if (free("installmentsCount")) candidate.installmentsCount = String(suggestion.installmentsCount);
  if (free("isInternational") && currency === suggestion.currency) candidate.isInternational = suggestion.isInternational;
  if (values.type === "purchase" && free("interestFree")) candidate.interestFree = suggestion.interestFree;

  const patch: Record<string, string | boolean> = {};
  const previous: Record<string, string | boolean> = {};
  for (const [field, value] of Object.entries(candidate) as Array<[SuggestionField, string | boolean]>) {
    const before = current(values, field);
    if (before === value) continue;
    patch[field] = value;
    previous[field] = before;
  }
  return { patch: patch as SuggestionPatch, previous: previous as SuggestionPatch };
}

/** Undoes a suggestion, leaving alone any field the owner changed after it was applied. */
export function revertSuggestion(previous: SuggestionPatch, touched: Touched): SuggestionPatch {
  return Object.fromEntries(Object.entries(previous).filter(([field]) => !touched.has(field as SuggestionField))) as SuggestionPatch;
}

/** "Como tu última compra en Netflix (7 nov)", naming the card when the suggestion comes from another one. */
export function suggestionNotice(suggestion: MerchantHistoryRow, today: IsoDate, otherCardName?: string): string {
  const what = suggestion.type === "cash_advance" ? "tu último avance" : "tu última compra";
  return `Como ${what} en ${suggestion.merchant.trim()}${otherCardName ? ` con ${otherCardName}` : ""} (${formatDateShort(suggestion.date, today)})`;
}
