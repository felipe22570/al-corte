import { describe, expect, it } from "vitest";
import { parseDateInput } from "@/lib/date-input";
import { formatDateInput, formatMonth } from "@/lib/format";

describe("Colombian date presentation", () => {
  it("keeps day before month independent of the browser locale", () => {
    expect(formatDateInput("2026-11-12")).toBe("12/11/2026");
    expect(parseDateInput("12/11/2026")).toBe("2026-11-12");
    expect(parseDateInput("12112026")).toBe("2026-11-12");
    expect(parseDateInput("11/12/2026")).toBe("2026-12-11");
    expect(formatDateInput("2028-02-29")).toBe("29/02/2028");
  });
  it("preserves empty, partial, and impossible dates for validation", () => {
    for (const value of ["", "12/", "31/02/2026", "29/02/2027", "1/2/2026"]) {
      expect(parseDateInput(value)).toBe(value);
      expect(formatDateInput(value)).toBe(value);
    }
  });
  it("includes the year and Spanish month names on filters and charts", () => {
    expect(formatMonth("2026-11")).toBe("nov 2026");
    expect(formatMonth("2026-11", "long")).toBe("Noviembre 2026");
    expect(formatMonth("2025-12")).toBe("dic 2025");
    expect(formatMonth("0002-01")).toBe("ene 0002");
  });
});
