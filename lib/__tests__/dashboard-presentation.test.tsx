import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CardSummary } from "@/components/card-summary";

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
});
