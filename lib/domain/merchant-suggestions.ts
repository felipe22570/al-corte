import { addMonths, compareIsoDates, type IsoDate } from "@/lib/domain/dates";

/** Movement types whose merchant history feeds suggestions (R11, D53). */
export type SuggestibleType = "purchase" | "cash_advance";

/**
 * A confirmed purchase or advance, reduced to the fields a suggestion can fill.
 * `installmentsCount` is the original N, not the effective plan (R11).
 */
export type MerchantHistoryRow = {
  id: string;
  merchant: string;
  cardId: string;
  date: IsoDate;
  createdAt: string;
  type: SuggestibleType;
  categoryId: string | null;
  installmentsCount: number;
  currency: "COP" | "USD";
  isInternational: boolean;
  interestFree: boolean;
};

/**
 * Normalized merchant name (R11, D53): lowercase, without accents, repeated signs or extra spaces.
 * Prefixes such as "google *" or "dlo*" stay because they tell merchants apart.
 */
export function normalizeMerchant(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/([^\p{L}\p{N}\s])\1+/gu, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Suggestions only look at the last twelve months of history. */
export function merchantHistorySince(today: IsoDate): IsoDate {
  return addMonths(today, -12);
}

/** Most recent first: date, then creation time, then id so ties are deterministic. */
function byRecency(first: MerchantHistoryRow, second: MerchantHistoryRow): number {
  return compareIsoDates(second.date, first.date) || second.createdAt.localeCompare(first.createdAt) || second.id.localeCompare(first.id);
}

/** Keeps only the latest row per type, normalized merchant and card, most recent first. */
export function latestByMerchant(rows: readonly MerchantHistoryRow[]): MerchantHistoryRow[] {
  const latest = new Map<string, MerchantHistoryRow>();
  for (const row of [...rows].sort(byRecency)) {
    const name = normalizeMerchant(row.merchant);
    if (!name) continue;
    const key = `${row.type}|${row.cardId}|${name}`;
    if (!latest.has(key)) latest.set(key, row);
  }
  return [...latest.values()];
}

/**
 * The latest purchase or advance of the same type with this merchant (R11, D53):
 * first on the same card, otherwise on any active card. Never suggests value, date or card.
 */
export function suggestFromHistory(
  query: { merchant: string; cardId: string; type: string },
  history: readonly MerchantHistoryRow[],
  activeCardIds: readonly string[],
): MerchantHistoryRow | null {
  const name = normalizeMerchant(query.merchant);
  if (!name || (query.type !== "purchase" && query.type !== "cash_advance")) return null;
  const active = new Set(activeCardIds);
  const matches = history.filter((row) => row.type === query.type && active.has(row.cardId) && normalizeMerchant(row.merchant) === name).sort(byRecency);
  return matches.find((row) => row.cardId === query.cardId) ?? matches[0] ?? null;
}

/** Merchant names for autocomplete, most recent first, one per normalized name. */
export function recentMerchantNames(history: readonly MerchantHistoryRow[], limit = 200): string[] {
  const names = new Map<string, string>();
  for (const row of [...history].sort(byRecency)) {
    const name = normalizeMerchant(row.merchant);
    if (name && !names.has(name)) names.set(name, row.merchant.trim());
  }
  return [...names.values()].slice(0, limit);
}

/**
 * Prefix of a merchant billed through an intermediary ("google *chatgpt" → "google", "dlo*netflix" → "dlo"). Charges
 * with the same prefix tend to share how the bank bills them (currency, installments), so the AI sees them as related
 * history (step 43). Names without `*` have no prefix.
 */
export function merchantPrefix(name: string): string | null {
  const normalized = normalizeMerchant(name);
  const star = normalized.indexOf("*");
  if (star < 0) return null;
  const prefix = normalized.slice(0, star).trim();
  return prefix.length >= 2 ? prefix : null;
}

/**
 * History the AI receives for an alert merchant (R10): first the same normalized name, then the same `*` prefix, each
 * group from the most recent, up to `limit` rows.
 */
export function relatedMerchantHistory<T extends { merchant: string; date: IsoDate }>(merchant: string, rows: readonly T[], limit = 5): T[] {
  const name = normalizeMerchant(merchant);
  const prefix = merchantPrefix(merchant);
  const recent = [...rows].sort((first, second) => second.date.localeCompare(first.date));
  const same = recent.filter((row) => normalizeMerchant(row.merchant) === name);
  const related = prefix ? recent.filter((row) => normalizeMerchant(row.merchant) !== name && merchantPrefix(row.merchant) === prefix) : [];
  return [...same, ...related].slice(0, limit);
}
