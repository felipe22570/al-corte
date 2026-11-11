import Decimal from "decimal.js";
import { differenceInDays, monthKey } from "./dates";

type Payment = { dueDate: string; paidAt: string | null; total: Decimal };

export function nextPayment<T extends Payment>(statements: T[]): T | null {
  return statements.filter((item) => !item.paidAt).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}

export function totalDueInMonth(statements: Payment[], month: string): Decimal {
  return statements.reduce((sum, item) => !item.paidAt && monthKey(item.dueDate) === month ? sum.plus(item.total) : sum, new Decimal(0));
}

export function daysUntil(today: string, dueDate: string): number {
  return differenceInDays(dueDate, today);
}
