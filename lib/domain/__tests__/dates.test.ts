import { describe, expect, it, vi } from "vitest";

import {
  TIME_ZONE,
  addDays,
  addMonths,
  clampDay,
  compareIsoDates,
  daysInMonth,
  formatIsoDate,
  isValidIsoDate,
  monthKey,
  parseIsoDate,
  todayInBogota,
} from "@/lib/domain/dates";

describe("dates", () => {
  it("uses Bogota as the business time zone", () => {
    expect(TIME_ZONE).toBe("America/Bogota");
  });

  it("parses and formats valid ISO dates", () => {
    expect(parseIsoDate("2026-03-16")).toEqual({ year: 2026, month: 3, day: 16 });
    expect(formatIsoDate(2026, 3, 6)).toBe("2026-03-06");
    expect(monthKey("2026-03-16")).toBe("2026-03");
  });

  it("rejects malformed and impossible ISO dates", () => {
    expect(() => parseIsoDate("2026/03/16")).toThrow("Fecha inválida");
    expect(() => parseIsoDate("2026-02-29")).toThrow("Fecha inválida");
    expect(() => formatIsoDate(2026, 13, 1)).toThrow("Mes inválido");
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
  });

  it("calculates month lengths, including leap years", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(2100, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(() => daysInMonth(2026, 0)).toThrow("Mes inválido");
  });

  it("clamps an unavailable day to the last day of the month", () => {
    expect(clampDay(2026, 2, 31)).toBe("2026-02-28");
    expect(clampDay(2028, 2, 31)).toBe("2028-02-29");
    expect(clampDay(2026, 4, 30)).toBe("2026-04-30");
    expect(() => clampDay(2026, 4, 0)).toThrow("Día inválido");
  });

  it("adds months without keeping a previous end-of-month clamp", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(() => addMonths("2026-03-16", 1.5)).toThrow("Número de meses inválido");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(() => addDays("2026-03-16", 0.5)).toThrow("Número de días inválido");
  });

  it("compares ISO dates chronologically", () => {
    expect(compareIsoDates("2026-03-15", "2026-03-16")).toBe(-1);
    expect(compareIsoDates("2026-03-16", "2026-03-16")).toBe(0);
    expect(compareIsoDates("2026-03-17", "2026-03-16")).toBe(1);
  });

  it("gets today in Bogota instead of the host time zone", () => {
    expect(todayInBogota(new Date("2026-03-16T03:00:00Z"))).toBe("2026-03-15");
    expect(todayInBogota(new Date("2026-03-16T05:00:00Z"))).toBe("2026-03-16");

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T05:00:00Z"));
    expect(todayInBogota()).toBe("2026-03-16");
    vi.useRealTimers();
  });
});
