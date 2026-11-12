import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";

describe("responsive content", () => {
  it("lets the page action wrap below a long title on narrow screens", () => {
    const html = renderToStaticMarkup(<PageHeader title="Suscripciones" action={<button>Agregar suscripción</button>} />);
    expect(html).toContain("flex-wrap");
    expect(html).toContain("Agregar suscripción");
  });

  it("keeps history category icons at their full size next to long labels", () => {
    const row = { id: "transaction", card_id: "card", category_id: null, date: "2026-11-11", type: "purchase", merchant: "Compra de prueba", note: null, amount: "1000", amount_cop: "1000", currency: "COP" as const, installments_count: 1 };
    const html = renderToStaticMarkup(<TransactionList rows={[row]} allRows={[row]} cards={[]} categories={[]} today="2026-11-11" />);
    expect(html).toMatch(/class="[^"]*size-5 shrink-0/);
  });
});
