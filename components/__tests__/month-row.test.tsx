import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthRow } from "@/components/month-row";
import { buildMonths } from "@/lib/domain/months";
import { CARD_COLORS } from "@/lib/card-colors";

describe("MonthRow", () => {
  const visa = { id: "a", name: "Visa", last4: "1234", color: "card-1" as const };
  const real = (overrides: Partial<Parameters<typeof buildMonths>[0][number]>) => ({
    cardId: "a", origin: "real" as const, cutoffDate: "2026-11-10", dueDate: "2026-11-18", paidAt: null,
    recordedTotal: new Decimal(100), projectedTotal: new Decimal(0), unconvertedCharges: [], ...overrides,
  });

  it("shows the due date, a due-soon warning and billed vs growth in the featured row", () => {
    const [month] = buildMonths([real({}), real({ cardId: "b", cutoffDate: "2026-11-25", dueDate: "2026-11-28", projectedTotal: new Decimal(30) })], "2026-11-15");
    const html = renderToStaticMarkup(<MonthRow month={month!} cards={[visa, { id: "b", name: "Master", last4: "5678", color: "card-2" }]} subscriptionNames={{}} today="2026-11-15" featured />);
    expect(html).toContain("pago 18 nov");
    expect(html).toContain("Vence en 3 días");
    expect(html).toContain("bg-warning-soft text-warning");
    expect(html).toContain("Ya facturado");
    expect(html).toContain("Aún puede crecer");
    expect(html).toMatch(/aria-hidden="true" class="flex h-2/);
  });

  it("hides a zero pending line under Pagado and the bar when only one card composes the month", () => {
    const [month] = buildMonths([real({ dueDate: "2026-10-28", paidAt: "2026-10-27" })], "2026-11-15");
    const html = renderToStaticMarkup(<MonthRow month={month!} cards={[visa]} subscriptionNames={{}} today="2026-11-15" />);
    expect(html).toContain("Pagado");
    expect(html).not.toContain("Pendiente de confirmar pago");
    expect(html).not.toContain("h-2 overflow-hidden");
  });

  it("labels a complete future month as an estimated total", () => {
    const summaries = buildMonths([real({ cutoffDate: "2026-12-10", dueDate: "2026-12-20" })], "2026-11-15");
    const html = renderToStaticMarkup(<MonthRow month={summaries.find((item) => item.month === "2026-12")!} cards={[visa]} subscriptionNames={{}} today="2026-11-15" />);
    expect(html).toContain("Total estimado");
    // Compact legend keeps each amount in its own right-aligned column, even with long card names.
    expect(html).toMatch(/grid-cols-\[minmax\(0,1fr\)_auto\][^>]*>.*Visa · •••• 1234.*<span class="text-right">/);
  });

  it("matches the six card colors with labeled composition", () => {
    const cards = CARD_COLORS.map((color) => ({ id: color, color, name: color, last4: "1234" }));
    const [month] = buildMonths(cards.map((card) => ({
      cardId: card.id, origin: "real" as const, cutoffDate: "2026-11-15", dueDate: "2026-11-28",
      paidAt: null, recordedTotal: new Decimal(10000), projectedTotal: new Decimal(0), unconvertedCharges: [],
    })), "2026-11-13");
    const html = renderToStaticMarkup(<MonthRow month={month!} cards={cards} subscriptionNames={{}} today="2026-11-14" />);
    for (const color of CARD_COLORS) {
      expect(html).toContain(`bg-${color}`);
      expect(html).toContain(`${color} · •••• 1234`);
    }
  });
  it("shows dollar charges apart without inventing COP when the TRM is missing (D33)", () => {
    const [month] = buildMonths([{
      cardId: "card", origin: "virtual", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null,
      recordedTotal: new Decimal(0), projectedTotal: new Decimal(0), projectedUsd: new Decimal("9.99"),
      unconvertedCharges: [{ subscriptionId: "sub", date: "2026-11-20", amountUsd: new Decimal("9.99") }],
    }], "2026-11-14");
    if (!month) throw new Error("Falta el mes");
    const html = renderToStaticMarkup(<MonthRow month={month} cards={[]} subscriptionNames={{ sub: "Servicio" }} today="2026-11-14" />);
    expect(html).not.toContain("Total conocido");
    expect(html).toContain("Total del mes");
    expect(html).toContain("US$ 9,99");
    expect(html).not.toContain(">$0<");
    expect(html).toContain("Falta la TRM para el equivalente en pesos");
    expect(html).toContain("Servicio");
    expect(html).not.toContain("Pagado");
    expect(html).toContain('href="/meses/2026-11"');
  });

  it("shows signed composition instead of a proportional bar for negative subtotals", () => {
    const [month] = buildMonths([
      { cardId: "a", origin: "real", cutoffDate: "2026-11-10", dueDate: "2026-11-20", paidAt: null, recordedTotal: new Decimal(100), projectedTotal: new Decimal(0), unconvertedCharges: [] },
      { cardId: "b", origin: "real", cutoffDate: "2026-11-10", dueDate: "2026-11-20", paidAt: null, recordedTotal: new Decimal(-20), projectedTotal: new Decimal(0), unconvertedCharges: [] },
    ], "2026-11-14");
    if (!month) throw new Error("Falta el mes");
    const html = renderToStaticMarkup(<MonthRow month={month} cards={[
      { id: "a", name: "Visa", last4: "1234", color: "card-1" },
      { id: "b", name: "Mastercard", last4: "5678", color: "card-2" },
    ]} subscriptionNames={{}} today="2026-11-14" />);
    expect(html).toContain("-$20");
    expect(html).not.toContain("Barra de composición");
  });
});
