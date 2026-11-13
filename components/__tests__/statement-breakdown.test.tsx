import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatementBreakdown } from "@/components/statement-breakdown";
import { StatementConcept, type StatementConceptData } from "@/components/statement-concept";

const payment: StatementConceptData = { key: "payments", label: "Abonos", total: "0.00", subtract: true, entries: [] };
const purchase: StatementConceptData = {
  key: "purchases",
  label: "Compras",
  total: "450000",
  entries: [{ id: "purchase", href: "/movimientos/purchase", description: "Mercado · 12 nov", amountCop: "450000" }],
};
const empty: StatementConceptData[] = [
  { key: "interest", label: "Intereses", total: "0.00", entries: [] },
  { key: "refunds", label: "Devoluciones", total: "0", subtract: true, entries: [] },
];

describe("statement presentation", () => {
  it("collects empty concepts in one closed disclosure without hiding active concepts", () => {
    const html = renderToStaticMarkup(<StatementBreakdown concepts={[purchase, ...empty]} payments={payment} />);
    expect(html.match(/<summary /g)).toHaveLength(2);
    expect(html).toContain("2 conceptos sin movimientos");
    expect(html).toContain('href="/movimientos/purchase"');
    expect(html).toContain("$450.000");
    expect(html).toContain("Intereses");
    expect(html).toContain("Devoluciones");
    expect(html).not.toContain("open=\"\"");
  });

  it("does not create a disclosure for each empty concept or for empty payments", () => {
    const html = renderToStaticMarkup(<StatementBreakdown concepts={empty} payments={payment} />);
    expect(html.match(/<summary /g)).toHaveLength(1);
    expect(html).toContain("No hay cargos en este extracto.");
    expect(html).not.toContain("−");
  });

  it("keeps a zero-total concept with movements visible rather than treating it as empty", () => {
    const html = renderToStaticMarkup(<StatementBreakdown concepts={[{ ...purchase, total: "0" }]} payments={payment} />);
    expect(html).toContain('href="/movimientos/purchase"');
    expect(html).not.toContain("conceptos sin movimientos");
    expect(html).not.toContain("No hay cargos");
  });

  it("keeps nonzero totals visible even without item rows", () => {
    const html = renderToStaticMarkup(<StatementBreakdown concepts={[{ ...purchase, entries: [] }]} payments={payment} />);
    expect(html).toContain("$450.000");
    expect(html).not.toContain("<summary");
    expect(html).not.toContain("conceptos sin movimientos");
  });

  it("shows payments separately with their original links and explanatory text", () => {
    const html = renderToStaticMarkup(<StatementBreakdown concepts={[purchase]} payments={{ ...payment, total: "12000", entries: [{ id: "payment", href: "/movimientos/payment", description: "Pago · 12 nov", amountCop: "12000" }] }} />);
    expect(html.indexOf('id="statement-payments-title"')).toBeGreaterThan(html.indexOf("$450.000"));
    expect(html).toContain("Los pagos se muestran aparte y no cambian el total del extracto.");
    expect(html).toContain('href="/movimientos/payment"');
    expect(html).toContain("−");
    expect(html).toContain("$12.000");
  });

  it("preserves USD amounts, COP estimates, and installment descriptions", () => {
    const html = renderToStaticMarkup(<StatementConcept concept={{ ...purchase, label: "Cuotas", entries: [{ id: "usd-2", href: "/movimientos/usd", description: "Compra en dólares · cuota 2", amountCop: "64000", amountUsd: "15.99" }] }} />);
    expect(html).toContain("US$ 15,99");
    expect(html).toContain("$64.000");
    expect(html).toContain("Estimado en pesos");
    expect(html).toContain("cuota 2");
    expect(html).toContain('href="/movimientos/usd"');
  });

  it("renders explicit expansion indicators without replacing native disclosure semantics", () => {
    const html = renderToStaticMarkup(<StatementConcept concept={purchase} />);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("lucide-chevron-down");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("group-open/disclosure:rotate-180");
    expect(html).not.toContain("aria-expanded");
  });

  it("retains refund signs only for nonzero refunds and handles a single empty concept", () => {
    const refund = renderToStaticMarkup(<StatementConcept concept={{ ...empty[1]!, total: "2500" }} />);
    expect(refund).toContain("−");
    expect(refund).toContain("$2.500");
    const html = renderToStaticMarkup(<StatementBreakdown concepts={[empty[0]!]} payments={payment} />);
    expect(html).toContain("1 concepto sin movimientos");
  });

  it("keeps column headings and puts the disclosure indicator before the label, not after amounts", () => {
    const html = renderToStaticMarkup(<StatementBreakdown concepts={[purchase]} payments={payment} />);
    expect(html).toContain("Concepto");
    expect(html).toContain("Total");
    const summary = html.match(/<summary[^>]*>(.*?)<\/summary>/)?.[1] ?? "";
    expect(summary.indexOf("lucide-chevron-down")).toBeLessThan(summary.indexOf("Compras"));
    expect(summary.indexOf("Compras")).toBeLessThan(summary.indexOf("$450.000"));
    expect(summary).toMatch(/text-right/);
    expect(summary.slice(summary.indexOf("$450.000"))).not.toContain("<svg");
  });
});
