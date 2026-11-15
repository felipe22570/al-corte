import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { buildMonths, overdueStatements, type MonthStatement } from "../months";
import { dueTone } from "@/lib/ui-status";

describe("payment month regressions", () => {
  const statement = (dueDate: string, paidAt: string | null, total: string): MonthStatement => ({
    cardId: dueDate, origin: "real", cutoffDate: "2026-10-15", dueDate, paidAt,
    recordedTotal: new Decimal(total), projectedTotal: new Decimal(0), unconvertedCharges: [],
  });
  const statements = [
    statement("2026-12-01", null, "10"), statement("2026-11-02", "2026-11-01", "20"),
    statement("2026-11-01", null, "30.25"), statement("2026-11-05", null, "40.75"),
  ];
  it("retains every unpaid overdue statement in its payment month", () => {
    const overdue = overdueStatements(statements, "2026-12-10");
    expect(overdue.months.get("2026-11")?.map((item) => item.dueDate)).toEqual(["2026-11-01", "2026-11-05"]);
    expect(overdueStatements(statements.filter((item) => item.paidAt), "2026-12-10").months.size).toBe(0);
    expect(overdueStatements([], "2026-12-10").months.size).toBe(0);
  });
  it("adds unpaid statements in the calendar month exactly", () => {
    expect(buildMonths(statements, "2026-11-10").find((month) => month.month === "2026-11")?.pendingConfirmation.toString()).toBe("71");
  });
  it("assigns due tones", () => {
    expect([6, 5, 0, -1].map((days) => dueTone(days, false))).toEqual(["neutral", "warning", "warning", "danger"]);
  });
});
