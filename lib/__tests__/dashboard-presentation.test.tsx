import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardSummary } from "@/components/card-summary";
import { CreditAvailability } from "@/components/credit-availability";
import { DashboardTotals } from "@/components/dashboard-totals";
import { Money } from "@/components/money";
import Decimal from "decimal.js";

const card = {
  id: "card-id",
  name: "Visa principal",
  bank: "Banco de prueba",
  last4: "1234",
  color: "card-1" as const,
  available: "4500000",
  utilization: "0.25",
  today: "2026-11-10",
};

describe("dashboard card presentation", () => {
  it("groups a labeled large next payment with its deadline and status", () => {
    const html = renderToStaticMarkup(<CardSummary {...card} payment={{ dueDate: "2026-11-15", total: "450000" }} />);
    expect(html).toContain('href="/tarjetas/card-id"');
    expect(html).toContain("Próximo pago");
    expect(html).toMatch(/text-amount-lg[^>]*>\$450\.000/);
    expect(html).toContain("Pago límite 15 nov");
    expect(html).toContain("Vence en 5 días");
    expect(html).toContain("bg-warning-soft text-warning");
    expect(html).toContain("Cupo disponible");
    expect(html).toContain("$4.500.000");
    expect(html).toContain('aria-valuenow="25"');
  });

  it("does not invent a payment or deadline when none is pending", () => {
    const html = renderToStaticMarkup(<CardSummary {...card} payment={null} />);
    expect(html).toContain("Sin pagos pendientes.");
    expect(html).not.toContain("Próximo pago");
    expect(html).not.toContain("Pago límite");
    expect(html).toContain("Cupo disponible");
  });
  it("describes over-limit credit with a positive amount and danger styling", () => {
    const html = renderToStaticMarkup(<CardSummary {...card} available="-1234567890" payment={null} />);
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
  it("renders qualitative monthly comparisons and preserves large totals", () => {
    const html = renderToStaticMarkup(<DashboardTotals due={new Decimal("999999999999")} debt={new Decimal("1234567890")} spending={new Decimal("1234567890")} previousSpending={new Decimal(0)} previousMonth="2026-10" />);
    expect(html).toContain("Más que octubre");
    expect(html).not.toContain("Mucho");
    expect(html).not.toContain("%");
    expect(html).toContain("$999.999.999.999");
    expect(html).toContain("$1.234.567.890");
  });
  it("allows full large amounts to reflow rather than clipping or abbreviating them", () => {
    const html = renderToStaticMarkup(<Money value="999999999999" currency="COP" size="lg" />);
    expect(html).toContain("max-w-full wrap-anywhere");
    expect(html).toContain("$999.999.999.999");
    expect(html).not.toContain("truncate");
  });
});
