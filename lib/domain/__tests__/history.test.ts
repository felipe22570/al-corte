import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { groupByDay, spendingByCategory, spendingByMonth } from "../history";

const rows = [
  { date: "2026-01-03", type: "purchase", amountCop: new Decimal("100"), cardId: "a", categoryId: "food" },
  { date: "2026-01-03", type: "refund", amountCop: new Decimal("20"), cardId: "a", categoryId: "food" },
  { date: "2025-12-31", type: "cash_advance", amountCop: new Decimal("50"), cardId: "b", categoryId: null },
  { date: "2026-01-02", type: "payment", amountCop: new Decimal("90"), cardId: "a", categoryId: "food" },
];

describe("history aggregation", () => {
  it("groups days newest first and applies credit signs to subtotals", () => {
    const days = groupByDay(rows);
    expect(days.map((day) => day.date)).toEqual(["2026-01-03", "2026-01-02", "2025-12-31"]);
    expect(days[0]?.total.toString()).toBe("80");
    expect(days[1]?.total.toString()).toBe("-90");
  });
  it("fills twelve months across year boundaries", () => {
    const months = spendingByMonth(rows, "2026-01");
    expect(months).toHaveLength(12);
    expect(months[0]?.month).toBe("2025-02");
    expect(months[0]?.amount.toString()).toBe("0");
    expect(months[10]?.amount.toString()).toBe("50");
    expect(months[11]?.amount.toString()).toBe("80");
  });
  it("subtracts refunds and excludes payments when grouping categories", () => {
    expect(spendingByCategory(rows, "2026-01").map((item) => [item.categoryId, item.amount.toString()])).toEqual([["food", "80"]]);
    expect(spendingByCategory([...rows, { ...rows[0]!, categoryId: "other", amountCop: new Decimal("10") }], "2026-01").map((item) => item.categoryId)).toEqual(["food", "other"]);
  });
});
