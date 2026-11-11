import Decimal from "decimal.js";
import { addMonths, monthKey } from "./dates";

export type HistoryMovement = { date: string; type: string; amountCop: Decimal; cardId: string; categoryId: string | null };

function spendingAmount(item: HistoryMovement): Decimal {
  if (item.type === "purchase" || item.type === "cash_advance") return item.amountCop;
  if (item.type === "refund") return item.amountCop.negated();
  return new Decimal(0);
}

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

export function spendingByMonth(movements: HistoryMovement[], month: string) {
  return Array.from({ length: 12 }, (_, index) => {
    const current = monthKey(addMonths(`${month}-01`, index - 11));
    const cards: Record<string, Decimal> = {};
    let amount = new Decimal(0);
    for (const item of movements) {
      if (monthKey(item.date) !== current) continue;
      const value = spendingAmount(item);
      amount = amount.plus(value);
      cards[item.cardId] = (cards[item.cardId] ?? new Decimal(0)).plus(value);
    }
    return { month: current, amount, cards };
  });
}

export function spendingByCategory(movements: HistoryMovement[], month: string) {
  const categories = new Map<string | null, Decimal>();
  for (const item of movements) {
    if (monthKey(item.date) !== month || !["purchase", "cash_advance", "refund"].includes(item.type)) continue;
    categories.set(item.categoryId, (categories.get(item.categoryId) ?? new Decimal(0)).plus(spendingAmount(item)));
  }
  return [...categories].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount.comparedTo(a.amount));
}
