import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthRow } from "@/components/month-row";
import { buildMonths } from "@/lib/domain/months";
import { CARD_COLORS } from "@/lib/card-colors";

describe("MonthRow", () => {
  it("matches the six card colors with labeled composition", () => {
    const cards = CARD_COLORS.map((color) => ({ id: color, color, name: color, last4: "1234" }));
    const [month] = buildMonths(cards.map((card) => ({
      cardId: card.id, origin: "real" as const, cutoffDate: "2026-11-15", dueDate: "2026-11-28",
      paidAt: null, recordedTotal: new Decimal(10000), projectedTotal: new Decimal(0), unconvertedCharges: [],
    })), "2026-11-13");
    const html = renderToStaticMarkup(<MonthRow month={month!} cards={cards} subscriptionNames={{}} />);
    for (const color of CARD_COLORS) {
      expect(html).toContain(`bg-${color}`);
      expect(html).toContain(`${color} · •••• 1234`);
    }
  });
  it("shows incomplete totals without inventing COP for USD charges", () => {
    const [month] = buildMonths([{
      cardId: "card", origin: "virtual", cutoffDate: "2026-11-25", dueDate: "2026-11-28", paidAt: null,
      recordedTotal: new Decimal(0), projectedTotal: new Decimal(0),
      unconvertedCharges: [{ subscriptionId: "sub", date: "2026-11-20", amountUsd: new Decimal("9.99") }],
    }], "2026-11-14");
    if (!month) throw new Error("Falta el mes");
    const html = renderToStaticMarkup(<MonthRow month={month} cards={[]} subscriptionNames={{ sub: "Servicio" }} />);
    expect(html).toContain("Total conocido");
    expect(html).toContain("US$ 9,99");
    expect(html).toContain("Servicio");
    expect(html).not.toContain("Pagado");
    expect(html).not.toContain("Cobros previstos: <span");
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
    ]} subscriptionNames={{}} />);
    expect(html).toContain("-$20");
    expect(html).not.toContain("Barra de composición");
  });
});
