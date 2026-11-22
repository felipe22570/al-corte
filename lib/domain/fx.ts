import { addDays, type IsoDate } from "./dates";

/** A day of the official TRM in `fx_rates`; `validFrom` starts its period in force (D57). */
export type FxRate = { date: IsoDate; usdCop: string; validFrom: IsoDate };

/**
 * TRM a statement uses (D52): the one in force on the last business day before the cutoff, which is the day before the
 * start of the period containing the cutoff. No holiday calendar needed. Null when either day is missing: never invented.
 */
export function trmForStatement(rates: readonly FxRate[], cutoffDate: IsoDate): string | null {
  const byDate = new Map(rates.map((rate) => [rate.date, rate]));
  const period = byDate.get(cutoffDate);
  return period ? byDate.get(addDays(period.validFrom, -1))?.usdCop ?? null : null;
}
