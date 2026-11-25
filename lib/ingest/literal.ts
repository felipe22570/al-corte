import Decimal from "decimal.js";

import { isValidIsoDate, type IsoDate } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";

import { normalizePhrase } from "./bancolombia";

/** What the fallback AI says it read from an alert with an unknown format (step 43). Text, not yet trusted. */
export type ExtractedAlert = {
  type: "purchase" | "cash_advance" | "payment" | "refund" | "other";
  amountText: string | null;
  currency: Currency | null;
  merchant: string | null;
  dateText: string | null;
  timeText: string | null;
  last4: string | null;
};

export type VerifiedFacts = {
  type: "purchase" | "cash_advance" | "payment" | "refund" | null;
  amount: string;
  currency: Currency;
  merchant: string | null;
  date: IsoDate | null;
  time: string | null;
  last4: string | null;
};

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** The value appears in the phrase as a whole number, not inside a longer one ("200.000" is not inside "1.200.000"). */
const appearsAsNumber = (phrase: string, value: string) => new RegExp(`(?<![\\d.,])${escape(value)}(?![\\d]|[.,]\\d)`).test(phrase);
/** Currency of the amount by what is written right before it: "USD15,99" or "US$ 15,99" are dollars; anything else, pesos. */
const currencyBefore = (phrase: string, value: string): Currency | null => {
  const currencies = [...phrase.matchAll(new RegExp(`(.{0,4})(?<![\\d.,])${escape(value)}(?![\\d]|[.,]\\d)`, "g"))]
    .map((match) => (/(?:USD|US\$)\s?$/i.test(match[1] ?? "") ? "USD" : "COP") as Currency);
  return currencies.length && currencies.every((currency) => currency === currencies[0]) ? currencies[0]! : null;
};
const MAX_AMOUNT = new Decimal("999999999999.99");
/** "140.910,00": dot for thousands, comma for 1 or 2 decimals (most alerts). */
const COLOMBIAN_AMOUNT = /^\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?$/;
/**
 * "500,000": the virtual advance alert groups thousands with commas and has no decimals. A comma followed by exactly 3
 * digits cannot be Colombian decimals, so this reading is unambiguous.
 */
const COMMA_THOUSANDS = /^\d{1,3}(?:,\d{3})+$/;

/**
 * R10: every number of the AI answer must appear literally in the alert. If the amount, a date, a time or the last 4
 * digits do not, nothing is trusted and the draft stays to review as it was. Currency is USD only when the amount is
 * written right after USD or US$; a mention elsewhere in the text does not count. A merchant that is not part of the phrase is dropped, since it may carry invented characters.
 */
export function verifyExtraction(rawPhrase: string, extracted: ExtractedAlert): VerifiedFacts | null {
  const phrase = normalizePhrase(rawPhrase);
  const { amountText, dateText, timeText, last4 } = extracted;
  if (!amountText || !extracted.currency) return null;
  const colombian = COLOMBIAN_AMOUNT.test(amountText);
  if ((!colombian && !COMMA_THOUSANDS.test(amountText)) || !appearsAsNumber(phrase, amountText)) return null;
  const amount = new Decimal(colombian ? amountText.replace(/\./g, "").replace(",", ".") : amountText.replace(/,/g, ""));
  if (amount.lte(0) || amount.gt(MAX_AMOUNT)) return null;
  if (extracted.currency !== currencyBefore(phrase, amountText)) return null;

  let date: IsoDate | null = null;
  if (dateText) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText);
    if (!match || !appearsAsNumber(phrase, dateText)) return null;
    date = `${match[3]}-${match[2]}-${match[1]}`;
    if (!isValidIsoDate(date)) return null;
  }
  let time: string | null = null;
  if (timeText) {
    const match = /^(\d{2}):(\d{2})$/.exec(timeText);
    if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || !appearsAsNumber(phrase, timeText)) return null;
    time = timeText;
  }
  if (last4 && (!/^\d{4}$/.test(last4) || !new RegExp(`\\*\\s*${last4}(?!\\d)`).test(phrase))) return null;

  const merchant = extracted.merchant?.trim();
  return {
    type: extracted.type === "other" ? null : extracted.type,
    amount: amount.toFixed(2),
    currency: extracted.currency,
    merchant: merchant && merchant.length <= 200 && phrase.toLowerCase().includes(merchant.toLowerCase()) ? merchant : null,
    date,
    time,
    last4: last4 ?? null,
  };
}
