import Decimal from "decimal.js";
import { monthKey } from "./dates";

export type StatementConcept = "single_purchases" | "installments" | "subscriptions" | "cash_advances" | "interest" | "handling_fees" | "insurance" | "adjustments" | "refunds" | "payments";
export type StatementItem = { concept: StatementConcept; amountCop: Decimal };
type MovementType = "purchase" | "cash_advance" | "advance_fee" | "interest" | "handling_fee" | "insurance" | "adjustment" | "refund" | "payment";
type StatementMovement = { type: MovementType; amountCop: Decimal; installmentsCount?: number; source?: "manual" | "subscription" | "import" | "email" | "system" };
const movementConcept: Record<Exclude<MovementType, "purchase">, StatementConcept> = {
  cash_advance: "cash_advances", advance_fee: "cash_advances", interest: "interest",
  handling_fee: "handling_fees", insurance: "insurance", adjustment: "adjustments",
  refund: "refunds", payment: "payments",
};

export function statementItemsFromMovements(movements: StatementMovement[], installments: Array<{ totalCop: Decimal; total?: Decimal }>): StatementItem[] {
  const items: StatementItem[] = [];
  for (const movement of movements) {
    if ((movement.type === "purchase" || movement.type === "cash_advance") && (movement.installmentsCount ?? 1) > 1) continue;
    const concept = movement.type === "purchase"
      ? movement.source === "subscription" ? "subscriptions" : "single_purchases"
      : movementConcept[movement.type];
    items.push({ concept, amountCop: movement.amountCop });
  }
  return items.concat(installments.map((installment) => ({ concept: "installments" as const, amountCop: installment.totalCop })));
}
const concepts: StatementConcept[] = ["single_purchases", "installments", "subscriptions", "cash_advances", "interest", "handling_fees", "insurance", "adjustments", "refunds", "payments"];
export function statementTotals(items: StatementItem[]) {
  const byConcept = Object.fromEntries(concepts.map((concept) => [concept, new Decimal(0)])) as Record<StatementConcept, Decimal>;
  items.forEach((item) => { byConcept[item.concept] = byConcept[item.concept].plus(item.amountCop); });
  const payments = byConcept.payments; const total = concepts.filter((concept) => concept !== "payments" && concept !== "refunds").reduce((sum, concept) => sum.plus(byConcept[concept]), new Decimal(0)).minus(byConcept.refunds);
  return { byConcept, total, payments };
}
export function availableCredit(input: { creditLimit: Decimal; charges: Decimal; billedInstallmentInterest: Decimal; payments: Decimal; refunds: Decimal }) {
  const used = input.charges.plus(input.billedInstallmentInterest).minus(input.payments).minus(input.refunds); const available = input.creditLimit.minus(used); return { used, available, utilization: input.creditLimit.isZero() ? new Decimal(0) : used.div(input.creditLimit) };
}
export function compareMonths(current: Decimal, previous: Decimal) { const diff = current.minus(previous); return { diff, pct: previous.isZero() ? null : diff.div(previous) }; }
export function monthlySpending(transactions: Array<{ date: string; type: string; amountCop: Decimal }>, month: string): Decimal {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mes inválido");
  return transactions.reduce((total, transaction) => {
    if (monthKey(transaction.date) !== month) return total;
    if (transaction.type === "purchase" || transaction.type === "cash_advance") return total.plus(transaction.amountCop);
    if (transaction.type === "refund") return total.minus(transaction.amountCop);
    return total;
  }, new Decimal(0));
}
