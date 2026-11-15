import Decimal from "decimal.js";

export type HistoryMovement = { date: string; type: string; amountCop: Decimal; cardId: string; categoryId: string | null };

export function groupByDay<T extends HistoryMovement>(movements: T[]) {
  const groups = new Map<string, { date: string; total: Decimal; movements: T[] }>();
  for (const item of movements) {
    const group = groups.get(item.date) ?? { date: item.date, total: new Decimal(0), movements: [] };
    group.movements.push(item);
    group.total = group.total.plus(item.type === "refund" || item.type === "payment" ? item.amountCop.negated() : item.amountCop);
    groups.set(item.date, group);
  }
  return [...groups.values()].sort((a, b) => b.date.localeCompare(a.date));
}
