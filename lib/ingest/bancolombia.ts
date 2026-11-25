import Decimal from "decimal.js";

import { isValidIsoDate, type IsoDate } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";

/**
 * What the rules read from a Bancolombia alert phrase (R10). They define the facts (type, amount, currency, date, time,
 * merchant as it came and last 4 digits); AI never does.
 * - `ignored`: the phrase does not mention a credit card ("T.Cred" or "T.Credito"); nothing is stored.
 * - `purchase`: the known purchase format, read exactly.
 * - `unknown`: mentions a credit card but has another verb or format; it becomes a draft to review (step 43 fallback).
 */
export type AlertReading =
  | { kind: "ignored" }
  | { kind: "purchase"; last4: string; currency: Currency; amount: string; merchant: string; date: IsoDate; time: string }
  | { kind: "unknown"; last4: string | null };

// Real alerts write the card as "T.Cred *1999" or "T.Credito *1999"; the Apps Script uses the same pattern (step 44).
const CREDIT_CARD = /T\.\s?Cr[eé]d(?:ito)?\b/i;
const LAST4 = /T\.\s?Cr[eé]d(?:ito)?\s*\*\s*(\d{4})(?!\d)/i;
// "Compraste COP140.910,00 en DIRECTV, el 17/11/2026 a las 12:27. Esta compra esta asociada a T.Cred *1999"
const PURCHASE = /^(?:Bancolombia:\s*)?Compraste\s+(COP|USD)\s?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)\s+en\s+(.+?),\s+el\s+(\d{2})\/(\d{2})\/(\d{4})\s+a\s+las\s+(\d{2}):(\d{2})\.\s+Esta\s+compra\s+est[aá]\s+asociada\s+a\s+T\.\s?Cr[eé]d(?:ito)?\s*\*\s*(\d{4})\.?$/i;
const MAX_AMOUNT = new Decimal("999999999999.99");

/** Same text with single spaces, as Gmail may bring non-breaking spaces or line breaks inside the phrase. */
export function normalizePhrase(phrase: string): string {
  return phrase.replace(/\s+/g, " ").trim();
}

/** "140.910,00" → "140910.00". */
function parseAmount(text: string): string | null {
  const amount = new Decimal(text.replace(/\./g, "").replace(",", "."));
  return amount.gt(0) && amount.lte(MAX_AMOUNT) ? amount.toFixed(2) : null;
}

export function readAlert(raw: string): AlertReading {
  const phrase = normalizePhrase(raw);
  if (!CREDIT_CARD.test(phrase)) return { kind: "ignored" };
  const last4 = LAST4.exec(phrase)?.[1] ?? null;
  const match = PURCHASE.exec(phrase);
  if (!match) return { kind: "unknown", last4 };
  const [, currency, amountText, merchant, day, month, year, hour, minute, purchaseLast4] = match as unknown as string[];
  const date = `${year}-${month}-${day}`;
  const amount = parseAmount(amountText!);
  if (!amount || !isValidIsoDate(date) || Number(hour) > 23 || Number(minute) > 59 || !merchant!.trim() || merchant!.trim().length > 200) return { kind: "unknown", last4 };
  return { kind: "purchase", last4: purchaseLast4!, currency: currency!.toUpperCase() as Currency, amount, merchant: merchant!.trim(), date, time: `${hour}:${minute}` };
}
