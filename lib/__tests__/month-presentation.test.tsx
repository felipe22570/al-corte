import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MonthCardsStrip } from "@/components/month-cards-strip";
import { CreditAvailability } from "@/components/credit-availability";
import { MonthRow } from "@/components/month-row";
import { Money } from "@/components/money";
import Decimal from "decimal.js";
import { buildMonths } from "@/lib/domain/months";

const card = {
  id: "card-id",
  name: "Visa principal",
  bank: "Banco de prueba",
  last4: "1234",
  color: "card-1" as const,
  available: new Decimal("4500000"), used: new Decimal("1500000"), utilization: new Decimal("0.25"),
  handlingFee: new Decimal(0), cutoffDay: 15, paymentDay: 28, archived: false,
};

describe("dashboard card presentation", () => {
  it("shows the card, available credit and utilization", () => {
    const html = renderToStaticMarkup(<MonthCardsStrip cards={[card]} />);
    expect(html).toContain('href="/tarjetas/card-id"');
    expect(html).toContain("Cupo disponible");
    expect(html).toContain("$4.500.000");
    expect(html).toContain('aria-valuenow="25"');
  });

  it("does not invent a payment or deadline when none is pending", () => {
    const html = renderToStaticMarkup(<MonthCardsStrip cards={[card]} />);
    expect(html).not.toContain("Próximo pago");
    expect(html).toContain("Cupo disponible");
  });
  it("describes over-limit credit with a positive amount and danger styling", () => {
    const html = renderToStaticMarkup(<MonthCardsStrip cards={[{ ...card, available: new Decimal("-1234567890") }]} />);
    expect(html).toContain("Sobrecupo de ");
    expect(html).toContain("$1.234.567.890");
    expect(html).not.toContain("-$");
    expect(html).toMatch(/bg-danger-soft[^>]*text-danger/);
    expect(html).toMatch(/text-amount text-danger[^>]*>\$1\.234\.567\.890/);
    expect(html).not.toContain("Cupo disponible");
  });
  it.each(["-0.01", "-0.49", "-0.50", "-0.99"])("describes an over-limit balance of %s without rounding it to zero", (value) => {
    for (const showLabel of [true, false]) {
      const html = renderToStaticMarkup(<CreditAvailability value={value} showLabel={showLabel} />);
      expect(html).toContain("Sobrecupo menor a ");
      expect(html).toContain("$1");
      expect(html).not.toContain("$0");
      expect(html).not.toContain("-$");
      expect(html).toContain("bg-danger-soft");
      expect(html).toMatch(/text-amount text-danger/);
    }
  });
  it("keeps the exact amount when the over-limit balance reaches one peso", () => {
    const html = renderToStaticMarkup(<CreditAvailability value="-1" />);
    expect(html).toContain("Sobrecupo de ");
    expect(html).toContain("$1");
    expect(html).not.toContain("menor a");
  });
  it.each(["0", "-0"])("keeps %s credit neutral and can omit the duplicated label on the detail page", (value) => {
    const html = renderToStaticMarkup(<CreditAvailability value={value} showLabel={false} />);
    expect(html).toContain("$0");
    expect(html).not.toContain("danger");
    expect(html).not.toContain("Cupo disponible");
  });
  it("preserves large monthly totals", () => {
    const [month] = buildMonths([{ cardId: card.id, origin: "real", cutoffDate: "2026-11-15", dueDate: "2026-11-28", paidAt: null, recordedTotal: new Decimal("999999999999"), projectedTotal: new Decimal(0), unconvertedCharges: [] }], "2026-11-10");
    const html = renderToStaticMarkup(<MonthRow month={month!} cards={[card]} subscriptionNames={{}} featured />);
    expect(html).toContain("$999.999.999.999");
  });
  it("allows full large amounts to reflow rather than clipping or abbreviating them", () => {
    const html = renderToStaticMarkup(<Money value="999999999999" currency="COP" size="lg" />);
    expect(html).toContain("max-w-full wrap-anywhere");
    expect(html).toContain("$999.999.999.999");
    expect(html).not.toContain("truncate");
  });
});
