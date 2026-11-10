import { expect, it } from "vitest";
import { formatCop, formatDateShort, formatDateWithWeekday, formatDueIn, formatMoney, formatPercent, formatRate, formatSignedMoney, formatUsd } from "@/lib/format";

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
