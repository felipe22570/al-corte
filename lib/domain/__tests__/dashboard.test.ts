import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { daysUntil, nextPayment, totalDueInMonth } from "../dashboard";
import { dueTone } from "@/lib/ui-status";

describe("dashboard", () => {
  const statements = [
    { dueDate: "2026-12-01", paidAt: null, total: new Decimal("10") },
    { dueDate: "2026-11-02", paidAt: "2026-11-01", total: new Decimal("20") },
    { dueDate: "2026-11-01", paidAt: null, total: new Decimal("30.25") },
    { dueDate: "2026-11-05", paidAt: null, total: new Decimal("40.75") },
  ];
  it("prioritizes the oldest unpaid statement, including overdue", () => {
    expect(nextPayment(statements)?.dueDate).toBe("2026-11-01");
    expect(nextPayment(statements.filter((item) => item.paidAt))).toBeNull();
    expect(nextPayment([])).toBeNull();
  });
  it("adds unpaid statements in the calendar month exactly", () => {
    expect(totalDueInMonth(statements, "2026-11").toString()).toBe("71");
  });
  it("calculates days across months and assigns due tones", () => {
    expect(daysUntil("2026-10-31", "2026-11-01")).toBe(1);
    expect([6, 5, 0, -1].map((days) => dueTone(days, false))).toEqual(["neutral", "warning", "warning", "danger"]);
  });
});
