import type { IsoDate } from "@/lib/domain/dates";
import { addDays } from "@/lib/domain/dates";

/** A row of the official TRM dataset (datos.gov.co, 32sa-8pi3): one value in force from one date to another. */
export type TrmRow = { valor: string; vigenciadesde: string; vigenciahasta: string };

/** Official TRM of each calendar day, expanding the periods in force (weekends and holidays share the previous value). */
export function trmByDate(rows: TrmRow[]): Record<IsoDate, string> {
  const result: Record<IsoDate, string> = {};
  for (const row of rows) {
    const to = row.vigenciahasta.slice(0, 10);
    for (let date = row.vigenciadesde.slice(0, 10); date <= to; date = addDays(date, 1)) result[date] = row.valor;
  }
  return result;
}
