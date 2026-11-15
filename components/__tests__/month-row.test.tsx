import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthRow } from "@/components/month-row";
import { buildMonths } from "@/lib/domain/months";

describe("MonthRow", () => {
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
