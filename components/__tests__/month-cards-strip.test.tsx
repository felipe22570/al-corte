import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthCardsStrip } from "@/components/month-cards-strip";

describe("MonthCardsStrip", () => {
  it("shows active cards while keeping archived balances in the registered debt", () => {
    const card = { name: "Visa", bank: "Banco", last4: "1234", color: "card-1" as const, cutoffDay: 15, paymentDay: 2, handlingFee: new Decimal(0), available: new Decimal(500), utilization: new Decimal("0.5") };
    const html = renderToStaticMarkup(<MonthCardsStrip cards={[
      { ...card, id: "active", archived: false, used: new Decimal(500) },
      { ...card, id: "archived", name: "Archivada", archived: true, used: new Decimal(300) },
    ]} />);
    expect(html).toContain("$800");
    expect(html).toContain('href="/tarjetas/active"');
    expect(html).not.toContain("Archivada");
  });
  it("identifies over-limit credit without presenting a negative available balance", () => {
    const html = renderToStaticMarkup(<MonthCardsStrip cards={[{
      id: "active", name: "Visa", bank: "Banco", last4: "1234", color: "card-1", archived: false,
      cutoffDay: 15, paymentDay: 2, handlingFee: new Decimal(0), available: new Decimal(-20),
      used: new Decimal(1020), utilization: new Decimal("1.02"),
    }]} />);
    expect(html).toContain("Sobrecupo de");
    expect(html).toContain("bg-danger-soft");
    expect(html).not.toContain("-$20");
  });
});
