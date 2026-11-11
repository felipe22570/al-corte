import type { HistoryRow } from "@/lib/history-types";

export function filterHistoryRows(rows: HistoryRow[], filters: { mes: string; tipo?: string; q?: string }): HistoryRow[] {
  const search = filters.q?.toLocaleLowerCase("es-CO");
  return rows.filter((item) => item.date.startsWith(filters.mes) && (!filters.tipo || item.type === filters.tipo) && (!search || [item.merchant, item.note].some((value) => value?.toLocaleLowerCase("es-CO").includes(search))));
}
