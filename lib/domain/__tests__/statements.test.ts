import { describe, expect, it } from "vitest";

import {
  cutoffDateForMonth,
  classifyStatement,
  dueDateFor,
  periodStartFor,
  previousCutoff,
  shiftStatement,
  statementCutoffFor,
  statementPeriod,
} from "@/lib/domain/statements";

describe("statements", () => {
  it("clamps cutoff dates to each month's final day", () => {
    expect(cutoffDateForMonth(31, 2026, 2)).toBe("2026-02-28");
    expect(cutoffDateForMonth(31, 2028, 2)).toBe("2028-02-29");
    expect(cutoffDateForMonth(30, 2026, 2)).toBe("2026-02-28");
    expect(() => cutoffDateForMonth(0, 2026, 2)).toThrow("Día de corte inválido");
  });

  it("assigns movements to the first cutoff on or after their date", () => {
    expect(statementCutoffFor(15, "2026-03-15")).toBe("2026-03-15");
    expect(statementCutoffFor(15, "2026-03-16")).toBe("2026-04-15");
    expect(statementCutoffFor(15, "2026-12-16")).toBe("2027-01-15");
    expect(statementCutoffFor(31, "2026-02-10")).toBe("2026-02-28");
    expect(statementCutoffFor(31, "2028-02-10")).toBe("2028-02-29");
    expect(statementCutoffFor(31, "2026-02-28")).toBe("2026-02-28");
    expect(statementCutoffFor(31, "2026-03-01")).toBe("2026-03-31");
    expect(statementCutoffFor(31, "2026-04-30")).toBe("2026-04-30");
    expect(statementCutoffFor(31, "2026-05-01")).toBe("2026-05-31");
    expect(statementCutoffFor(30, "2026-02-15")).toBe("2026-02-28");
    expect(statementCutoffFor(30, "2026-03-01")).toBe("2026-03-30");
  });

  it("finds the previous cutoff and period start", () => {
    expect(previousCutoff(31, "2026-03-31")).toBe("2026-02-28");
    expect(periodStartFor(31, "2026-03-31")).toBe("2026-03-01");
    expect(periodStartFor(31, "2026-02-28")).toBe("2026-02-01");
    expect(periodStartFor(15, "2026-01-15")).toBe("2025-12-16");
  });

  it("uses the first payment day strictly after the cutoff", () => {
    expect(dueDateFor(5, "2026-03-15")).toBe("2026-04-05");
    expect(dueDateFor(30, "2026-03-15")).toBe("2026-03-30");
    expect(dueDateFor(15, "2026-12-30")).toBe("2027-01-15");
    expect(dueDateFor(31, "2026-02-05")).toBe("2026-02-28");
    expect(dueDateFor(15, "2026-03-15")).toBe("2026-04-15");
    expect(() => dueDateFor(32, "2026-03-15")).toThrow("Día de pago inválido");
  });

  it("shifts statements using the configured cutoff day", () => {
    expect(shiftStatement(31, "2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftStatement(31, "2026-01-31", 2)).toBe("2026-03-31");
    expect(shiftStatement(31, "2026-02-28", -1)).toBe("2026-01-31");
  });

  it("builds the statement period for a card and a movement date", () => {
    expect(statementPeriod({ cutoffDay: 15, paymentDay: 5 }, "2026-03-16")).toEqual({
      periodStart: "2026-03-16",
      cutoffDate: "2026-04-15",
      dueDate: "2026-05-05",
    });
  });
  it("classifies statements by open cutoff and payment status", () => {
    const base = { cutoffDate: "2026-03-15", dueDate: "2026-04-05", paidAt: null };
    expect(classifyStatement(base, "2026-03-15", "2026-03-10")).toEqual({ period: "open", status: "pending" });
    expect(classifyStatement({ ...base, cutoffDate: "2026-04-15", paidAt: "2026-03-01T12:00:00Z" }, "2026-03-15", "2026-03-10")).toEqual({ period: "upcoming", status: "paid" });
    expect(classifyStatement({ ...base, cutoffDate: "2026-02-15", dueDate: "2026-03-05" }, "2026-03-15", "2026-03-10")).toEqual({ period: "past", status: "overdue" });
    expect(classifyStatement({ ...base, dueDate: "2026-03-10" }, "2026-03-15", "2026-03-10").status).toBe("pending");
  });
});
