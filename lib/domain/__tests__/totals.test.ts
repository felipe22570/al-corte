import Decimal from "decimal.js";
import { expect, it } from "vitest";
import { availableCredit, compareMonths, monthlySpending, statementItemsFromMovements, statementTotals } from "@/lib/domain/totals";

it("separa pagos y devoluciones del total del extracto", () => {
  const result = statementTotals([{ concept: "single_purchases", amountCop: new Decimal(100000) }, { concept: "installments", amountCop: new Decimal(50000) }, { concept: "refunds", amountCop: new Decimal(10000) }, { concept: "payments", amountCop: new Decimal(20000) }]);
  expect(result.total.toString()).toBe("140000"); expect(result.payments.toString()).toBe("20000");
});
it("excluye el movimiento padre y usa el total COP de cada cuota", () => {
  const items = statementItemsFromMovements(
    [{ type: "purchase", amountCop: new Decimal("400000"), installmentsCount: 3 }],
    [{ totalCop: new Decimal("141640"), total: new Decimal("35.41") }],
  );
  expect(statementTotals(items).total.toString()).toBe("141640");
});
it("desglosa conceptos y suma ajustes, pero no pagos", () => {
  const items = statementItemsFromMovements([
    { type: "purchase", amountCop: new Decimal("100"), installmentsCount: 1 },
    { type: "purchase", amountCop: new Decimal("20"), source: "subscription" },
    { type: "cash_advance", amountCop: new Decimal("30") },
    { type: "advance_fee", amountCop: new Decimal("5") },
    { type: "handling_fee", amountCop: new Decimal("10") },
    { type: "insurance", amountCop: new Decimal("7") },
    { type: "interest", amountCop: new Decimal("3") },
    { type: "adjustment", amountCop: new Decimal("4") },
    { type: "refund", amountCop: new Decimal("6") },
    { type: "payment", amountCop: new Decimal("40") },
  ], [{ totalCop: new Decimal("50") }, { totalCop: new Decimal("60") }]);
  const result = statementTotals(items);
  expect(result.byConcept.cash_advances.toString()).toBe("35");
  expect(result.byConcept.installments.toString()).toBe("110");
  expect(result.total.toString()).toBe("283");
  expect(result.payments.toString()).toBe("40");
});
it("incluye compras y avances y resta devoluciones del mes", () => {
  expect(monthlySpending([
    { date: "2026-03-01", type: "purchase", amountCop: new Decimal("100000") },
    { date: "2026-03-03", type: "cash_advance", amountCop: new Decimal("20000") },
    { date: "2026-03-04", type: "refund", amountCop: new Decimal("5000") },
    { date: "2026-03-05", type: "payment", amountCop: new Decimal("60000") },
    { date: "2026-03-06", type: "interest", amountCop: new Decimal("600") },
    { date: "2026-03-07", type: "advance_fee", amountCop: new Decimal("700") },
    { date: "2026-03-08", type: "purchase", amountCop: new Decimal("1000") },
    { date: "2026-04-01", type: "purchase", amountCop: new Decimal("1000") },
  ], "2026-03").toString()).toBe("116000");
  expect(() => monthlySpending([], "2026-13")).toThrow("Mes inválido");
});
it("calcula cupo disponible, utilización y comparación mensual", () => {
  const credit = availableCredit({ creditLimit: new Decimal(5000000), charges: new Decimal(1500000), billedInstallmentInterest: new Decimal(20000), payments: new Decimal(500000), refunds: new Decimal(20000) });
  expect(credit.used.toString()).toBe("1000000"); expect(credit.available.toString()).toBe("4000000"); expect(credit.utilization.toString()).toBe("0.2");
  expect(availableCredit({ creditLimit: new Decimal(0), charges: new Decimal(0), billedInstallmentInterest: new Decimal(0), payments: new Decimal(0), refunds: new Decimal(0) }).utilization.toString()).toBe("0");
  expect(compareMonths(new Decimal(100), new Decimal(0)).pct).toBeNull();
  expect(compareMonths(new Decimal(150), new Decimal(100)).pct?.toString()).toBe("0.5");
});
