import Decimal from "decimal.js";
import { daysBetween, type IsoDate } from "./dates";
import { normalizeMerchant } from "./merchant-suggestions";
import type { Currency } from "./money";

/** Types of the statement charges compared by card, statement, type and currency (R11, D55). */
const STATEMENT_CHARGES = new Set(["interest", "handling_fee", "insurance"]);
/** A subscription charge created by the app matches the bank's within this many days. */
const SUBSCRIPTION_DAYS = 7;

/** A line of the monthly file, already tied to a card of the owner. */
export type ImportRow = {
  key: string; cardId: string; type: string; date: IsoDate; merchant: string; amount: string; currency: Currency;
  /** Cutoff of the statement the bank billed it in. */
  statementCutoff: IsoDate;
};
/** A movement already registered in Al Corte. */
export type ExistingMovement = {
  id: string; cardId: string; type: string; date: IsoDate; merchant: string | null; amount: string; currency: Currency; importKey: string | null;
  subscriptionId: string | null; subscriptionName: string | null; statementCutoff: IsoDate;
};
export type ExistingPayment = { id: string; cardId: string; date: IsoDate; amount: string; currency: Currency };

export type ImportStatus = "new" | "registered" | "conflict" | "statement_conflict" | "payment_registered" | "payment_missing";
export type ConflictReason = "same_day_amount" | "subscription_amount";
export type ClassifiedRow = { key: string; status: ImportStatus; match?: { id: string; amount: string; merchant: string | null; date: IsoDate }; reason?: ConflictReason };

const sameAmount = (first: string, second: string) => new Decimal(first).equals(second);
const near = (first: IsoDate, second: IsoDate) => Math.abs(daysBetween(first, second)) <= SUBSCRIPTION_DAYS;

/**
 * Identity of each line of the file (R11, D55): new, already registered or in conflict. Payments are never imported: they
 * are already registered or offered for the payment form. Each movement of the app matches a single line, and the file key
 * wins over every other rule. A conflict is never imported without the owner's decision.
 */
export function classifyImportRows(rows: readonly ImportRow[], movements: readonly ExistingMovement[], payments: readonly ExistingPayment[]): ClassifiedRow[] {
  const claimed = new Set<string>();
  const results = new Map<string, ClassifiedRow>();
  const settle = (row: ImportRow, status: ImportStatus, match?: ExistingMovement | ExistingPayment, reason?: ConflictReason) => {
    if (match) claimed.add(match.id);
    results.set(row.key, {
      key: row.key, status, reason,
      match: match && { id: match.id, amount: match.amount, date: match.date, merchant: "merchant" in match ? match.merchant : null },
    });
  };
  const free = (movement: ExistingMovement, row: ImportRow) => !claimed.has(movement.id) && movement.cardId === row.cardId;
  const charges = rows.filter((row) => row.type !== "payment");
  const pending = () => charges.filter((row) => !results.has(row.key));

  for (const row of charges) {
    const match = movements.find((movement) => free(movement, row) && movement.importKey === row.key);
    if (match) settle(row, "registered", match);
  }
  for (const row of pending()) {
    if (STATEMENT_CHARGES.has(row.type)) {
      const match = movements.find((movement) => free(movement, row) && movement.type === row.type && movement.currency === row.currency && movement.statementCutoff === row.statementCutoff);
      if (match) settle(row, sameAmount(match.amount, row.amount) ? "registered" : "statement_conflict", match);
      else settle(row, "new");
      continue;
    }
    const name = normalizeMerchant(row.merchant);
    const exact = movements.find((movement) => free(movement, row) && movement.date === row.date && movement.currency === row.currency
      && sameAmount(movement.amount, row.amount) && normalizeMerchant(movement.merchant ?? "") === name);
    if (exact) settle(row, "registered", exact);
  }
  for (const row of pending()) {
    const charges = movements.filter((movement) => free(movement, row) && movement.subscriptionId !== null && movement.currency === row.currency && near(movement.date, row.date))
      .sort((first, second) => Math.abs(daysBetween(first.date, row.date)) - Math.abs(daysBetween(second.date, row.date)));
    const same = charges.find((movement) => sameAmount(movement.amount, row.amount));
    if (same) { settle(row, "registered", same); continue; }
    const name = normalizeMerchant(row.merchant);
    const named = charges.find((movement) => [movement.subscriptionName, movement.merchant].some((candidate) => candidate && name.includes(normalizeMerchant(candidate))));
    if (named) settle(row, "conflict", named, "subscription_amount");
  }
  for (const row of pending()) {
    const match = movements.find((movement) => free(movement, row) && movement.date === row.date && movement.currency === row.currency && sameAmount(movement.amount, row.amount));
    if (match) settle(row, "conflict", match, "same_day_amount");
    else settle(row, "new");
  }

  const claimedPayments = new Set<string>();
  for (const row of rows.filter((item) => item.type === "payment")) {
    const match = payments.find((item) => !claimedPayments.has(item.id) && item.cardId === row.cardId && item.date === row.date && item.currency === row.currency && sameAmount(item.amount, row.amount));
    if (match) claimedPayments.add(match.id);
    settle(row, match ? "payment_registered" : "payment_missing", match);
  }
  return rows.map((row) => results.get(row.key)!);
}
