import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { loadMonthOverview, type MonthReadSource } from "../months";

describe("loadMonthOverview", () => {
  it("loads every charge in each historical month and preserves overdue months outside the page", async () => {
    const statements = [
      ["a", "2026-10-02", "paid"], ["b", "2026-10-20", "paid"],
      ["c", "2026-09-02", "paid"], ["d", "2026-08-02", null], ["e", "2026-07-02", null],
    ].map(([id, dueDate, paidAt]) => ({
      id: id!, cardId: "visa", periodStart: "2026-01-01", cutoffDate: "2026-01-15", dueDate: dueDate!, paidAt: paidAt ?? null,
    }));
    const loadCharges = vi.fn(async (ids: string[]) => ({
      movements: ids.map((id) => ({ id: `m-${id}`, statementId: id, type: "purchase" as const, amountCop: new Decimal(100), categoryId: null, date: "2026-01-01" })),
      installments: [],
    }));
    const source: MonthReadSource = {
      loadCards: async () => [], loadStatements: async () => statements, loadSubscriptions: async () => [],
      loadFxRate: async () => null, loadCharges, loadSubscriptionMovements: async () => [],
    };
    const first = await loadMonthOverview(source, "2026-11-14", { historySize: 1 });
    expect(first.history.map((month) => [month.month, month.total.toString()])).toEqual([["2026-10", "200"]]);
    expect([...first.overdue.months.keys()].sort()).toEqual(["2026-07", "2026-08"]);
    expect(first.overdue.total.toString()).toBe("200");
    expect(first.current.total.toString()).toBe("0");
    const next = await loadMonthOverview(source, "2026-11-14", { historySize: 1, before: first.historyNextBefore! });
    expect(next.history.map((month) => [month.month, month.total.toString()])).toEqual([["2026-09", "100"]]);
    expect(loadCharges.mock.calls[0]?.[0]).toEqual(expect.arrayContaining(["a", "b", "d", "e"]));
    expect(loadCharges.mock.calls[0]?.[0]).not.toContain("c");
  });

  it("loads only the relevant statement charges while retaining older overdue alerts", async () => {
    const statement = (id: string, dueDate: string, paidAt: string | null) => ({
      id, cardId: "visa", periodStart: "2026-01-01", cutoffDate: "2026-01-15", dueDate, paidAt,
    });
    const loadCharges = vi.fn(async () => ({ movements: [], installments: [] }));
    const source: MonthReadSource = {
      loadCards: async () => [],
      loadStatements: async () => [
        statement("shown", "2026-10-02", "paid"), statement("hidden", "2026-09-02", "paid"),
        statement("overdue", "2026-08-02", null), statement("future", "2028-01-02", null),
      ],
      loadSubscriptions: async () => [],
      loadFxRate: async () => null,
      loadCharges,
      loadSubscriptionMovements: async () => [],
    };
    const overview = await loadMonthOverview(source, "2026-11-14", { historySize: 1 });
    expect(loadCharges).toHaveBeenCalledWith(["shown", "overdue"]);
    expect(overview.history.map((month) => month.month)).toEqual(["2026-10"]);
    expect(overview.historyNextBefore).toBe("2026-10");
    expect(overview.overdue.months.get("2026-08")?.[0]?.id).toBe("overdue");
    expect(overview.current.total.eq(new Decimal(0))).toBe(true);
    expect(overview.hasLaterCommitments).toBe(true);
  });

  it("does not duplicate a real subscription charge assigned to an unloaded extract", async () => {
    const source: MonthReadSource = {
      loadCards: async () => [{ id: "visa", cutoffDay: 25, paymentDay: 28, archived: false, handlingFee: new Decimal(0) }],
      loadStatements: async () => [],
      loadSubscriptions: async () => [{
        id: "sub", cardId: "visa", categoryId: null, amount: new Decimal(10), currency: "USD",
        frequency: "monthly", billingDay: 20, startDate: "2026-01-01", status: "active",
      }],
      loadFxRate: async () => null,
      loadCharges: async () => ({ movements: [], installments: [] }),
      loadSubscriptionMovements: async () => [{
        id: "charge", statementId: "not-loaded", type: "purchase", amountCop: new Decimal(40000),
        categoryId: null, subscriptionId: "sub", date: "2026-11-20", source: "subscription",
      }],
    };
    const overview = await loadMonthOverview(source, "2026-11-14");
    expect(overview.current.statements).toHaveLength(0);
    expect(overview.current.complete).toBe(true);
    expect(overview.future[0]?.complete).toBe(false);
    expect(overview.future[0]?.unconvertedCharges[0]?.subscriptionId).toBe("sub");
  });

  it("assigns six recorded installments to their six saved payment months", async () => {
    const statements = Array.from({ length: 6 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return { id: `s${index}`, cardId: "visa", periodStart: `2027-${month}-01`, cutoffDate: `2027-${month}-15`, dueDate: `2027-${month}-28`, paidAt: null };
    });
    const source: MonthReadSource = {
      loadCards: async () => [],
      loadStatements: async () => statements,
      loadSubscriptions: async () => [],
      loadFxRate: async () => null,
      loadCharges: async () => ({
        movements: [{ id: "purchase", statementId: "s0", type: "purchase", amountCop: new Decimal(600000), installmentsCount: 6, categoryId: "food", date: "2027-01-01" }],
        installments: statements.map((statement, index) => ({ id: `i${index}`, statementId: statement.id, categoryId: "food", totalCop: new Decimal(100000) })),
      }),
      loadSubscriptionMovements: async () => [],
    };
    const overview = await loadMonthOverview(source, "2026-12-14");
    expect(overview.future.map((month) => month.month)).toEqual(["2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"]);
    expect(overview.future.every((month) => month.total.eq(100000))).toBe(true);
  });

  it("keeps the total stable when a projected subscription becomes a real charge", async () => {
    const card = { id: "visa", cutoffDay: 25, paymentDay: 28, archived: false, handlingFee: new Decimal(0) };
    const subscription = { id: "sub", cardId: "visa", categoryId: null, amount: new Decimal(20000), currency: "COP" as const, frequency: "monthly" as const, billingDay: 20, startDate: "2026-01-01", status: "active" as const };
    const statement = { id: "statement", cardId: "visa", periodStart: "2026-10-26", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null };
    const movement = { id: "charge", statementId: statement.id, type: "purchase" as const, source: "subscription" as const, amountCop: new Decimal(20000), categoryId: null, subscriptionId: "sub", date: "2026-11-20" };
    const source: MonthReadSource = {
      loadCards: async () => [card], loadStatements: async () => [statement], loadSubscriptions: async () => [subscription],
      loadFxRate: async () => null, loadCharges: async () => ({ movements: [], installments: [] }), loadSubscriptionMovements: async () => [],
    };
    const projected = await loadMonthOverview(source, "2026-11-14");
    const recorded = await loadMonthOverview({ ...source, loadCharges: async () => ({ movements: [movement], installments: [] }), loadSubscriptionMovements: async () => [movement] }, "2026-11-14");
    expect(projected.current.total.toString()).toBe("20000");
    expect(recorded.current.total.toString()).toBe("20000");
    expect(recorded.current.projected.isZero()).toBe(true);
  });
});
