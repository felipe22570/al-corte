import Decimal from "decimal.js";
import type { Currency } from "./money";

/**
 * Difference between the bank value and the calculation (R8, D33), or null when the bank's rounding explains it:
 * banks round each balance up to the next peso or dollar, so 0 ≤ bank − calculated ≤ 1 is not shown.
 */
export function bankDifference(calculated: Decimal, real: Decimal | null): Decimal | null {
  if (real === null) return null;
  const difference = real.minus(calculated);
  return difference.gte(0) && difference.lte(1) ? null : difference;
}

/**
 * A statement is paid when every currency with charges is marked (D33); a statement without charges uses COP.
 * Returns the latest payment date, or null while a currency is still unmarked.
 */
export function statementPaidAt(paidAt: Partial<Record<Currency, string | null>>, currencies: Currency[]): string | null {
  const required = currencies.length ? currencies : ["COP" as const];
  const dates = required.map((currency) => paidAt[currency] ?? null);
  if (dates.some((date) => date === null)) return null;
  return dates.reduce<string>((latest, date) => (date! > latest ? date! : latest), dates[0]!);
}
