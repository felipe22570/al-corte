import { expect, it } from "vitest";
import { formatCop, formatCopCompact, formatDateShort, formatDateWithWeekday, formatDueIn, formatMoney, formatMonth, formatPercent, formatRate, formatSignedMoney, formatSpendingComparison, formatUsd } from "@/lib/format";

it("formatea dinero sin perder precisión", () => {
  expect(formatCop("1284500")).toBe("$1.284.500");
  expect(formatCop("0")).toBe("$0");
  expect(formatCop("1000000000")).toBe("$1.000.000.000");
  expect(formatUsd("1234.5")).toBe("US$ 1.234,50");
  expect(formatUsd("15.99")).toBe("US$ 15,99");
  expect(formatCop("-1234.5")).toBe("-$1.235");
  expect(formatMoney("15.99", "USD")).toBe("US$ 15,99");
  expect(formatSignedMoney("15.99", "USD", "credit")).toBe("+US$ 15,99");
  expect(formatSignedMoney("15.99", "USD", "charge")).toBe("-US$ 15,99");
});
it("abrevia los ejes de dinero sin perder el formato colombiano", () => {
  expect(formatCopCompact("1050000000")).toBe("$1.050 M");
  expect(formatCopCompact("350000000")).toBe("$350 M");
  expect(formatCopCompact("1500000")).toBe("$1,5 M");
  expect(formatCopCompact("350000")).toBe("$350 mil");
  expect(formatCopCompact("0")).toBe("$0");
  expect(formatCopCompact("-350000000")).toBe("-$350 M");
});
it("usa nombres cortos sin año solo cuando se pide para el eje", () => {
  expect(formatMonth("2026-11", "month-only")).toBe("nov");
  expect(formatMonth("2026-12", "month-only")).toBe("dic");
  expect(formatMonth("2026-11")).toBe("nov 2026");
  expect(formatMonth("2026-11", "long")).toBe("Noviembre 2026");
  expect(formatMonth("2026-10", "name")).toBe("octubre");
});
it.each([
  ["1000000", "0", "Más que octubre"],
  ["0", "0", "Igual que octubre"],
  ["999", "999", "Igual que octubre"],
  ["1000", "999", "Más que octubre"],
  ["999", "998", "Más que octubre"],
  ["998", "999", "Menos que octubre"],
  ["0", "1", "Menos que octubre"],
  ["-998", "-999", "Más que octubre"],
  ["-1000", "-999", "Menos que octubre"],
  ["-999", "-999", "Igual que octubre"],
  ["10990", "1000", "999% más que octubre"],
  ["10990.01", "1000", "Mucho más que octubre"],
  ["-10000", "1000", "Mucho menos que octubre"],
  ["1500", "1000", "50% más que octubre"],
  ["500", "1000", "50% menos que octubre"],
  ["0", "-1000", "Más que octubre"],
  ["-2000", "-1000", "Menos que octubre"],
])("keeps monthly comparisons meaningful for %s vs %s", (current, previous, expected) => {
  expect(formatSpendingComparison(current, previous, "2026-10")).toBe(expected);
});
it("formatea fechas, porcentajes y vencimientos", () => {
  expect(formatDateShort("2026-11-15", "2026-01-01")).toBe("15 nov");
  expect(formatDateShort("2025-11-15", "2026-01-01")).toBe("15 nov 2025");
  expect(formatDateWithWeekday("2024-11-15", "2024-01-01")).toBe("vie 15 nov");
  expect(formatDateShort("2028-02-29", "2028-01-01")).toBe("29 feb");
  expect(formatPercent("0.68")).toBe("68%");
  expect(formatPercent("0")).toBe("0%");
  expect(formatPercent("1")).toBe("100%");
  expect(formatRate("0.2845")).toBe("28,45% E.A.");
  expect([0, 1, 3, -2].map(formatDueIn)).toEqual(["hoy", "mañana", "en 3 días", "hace 2 días"]);
});
