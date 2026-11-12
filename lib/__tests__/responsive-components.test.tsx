import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { TransactionForm } from "@/components/transaction-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions/transactions", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }));

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

  it("keeps the selected category icon at full size in the transaction form", () => {
    const cardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const categoryId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const html = renderToStaticMarkup(<TransactionForm
      cards={[{ id: cardId, name: "Visa", last4: "1234", color: "card-1", cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.28", advanceRateEa: "0.32", advanceFee: "0", amortizationMethod: "fixed_principal" }]}
      categories={[{ id: categoryId, name: "Mercado", icon: "shopping-cart" }]}
      today="2026-11-11"
      latestRate={null}
      edit={{ id: "movement", initial: { cardId, categoryId, type: "purchase", date: "2026-11-11", amount: "1000", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, merchant: "Prueba", note: "" }, original: { cardId, type: "purchase", rateEaApplied: "0.28" }, hasPaidInstallments: false }}
    />);
    expect(html).toMatch(/class="[^"]*size-5 shrink-0 text-muted-foreground/);
  });
});
