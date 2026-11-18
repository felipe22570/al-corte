import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatementDetailPage from "./page";

const fixture = vi.hoisted(() => ({
  statement: { id: "statement", period_start: "2026-10-16", cutoff_date: "2026-11-15", due_date: "2026-11-30", paid_at: null as string | null, real_total: null as string | null },
  saved: true,
  interestMode: "per_installment",
  realInterest: false,
}));
const estimates = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/queries/interest-estimates", () => ({ loadInterestEstimates: estimates.load }));
vi.mock("@/components/statement-interest-form", () => ({ StatementInterestForm: () => <div>Formulario de intereses reales</div> }));

vi.mock("@/lib/domain/dates", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/domain/dates")>(),
  todayInBogota: () => "2026-11-12",
}));
vi.mock("@/components/statement-controls", () => ({
  StatementControls: ({ paid, realTotal }: { paid: boolean; realTotal: string | null }) => <div data-paid={String(paid)} data-real-total={realTotal}>Controles del extracto</div>,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (table: string) => {
      const movement = (id: string, type: string, amount: string, extra = {}) => ({ id, type, source: "manual", merchant: id, date: "2026-11-12", currency: "COP", amount, amount_cop: amount, installments_count: 1, ...extra });
      const result = (data: unknown) => Promise.resolve({ data, error: null });
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: () => result(table === "cards"
          ? { id: "11111111-1111-4111-8111-111111111111", name: "Visa de prueba", color: "card-3", last4: "1234", cutoff_day: 15, payment_day: 30, interest_mode: fixture.interestMode, archived_at: null }
          : table === "statements" ? (fixture.saved ? fixture.statement : null)
          : table === "fx_rates" ? { usd_cop: "4000" }
          : { single_purchases: "12500", installments: "25000", subscriptions: "64000", cash_advances: "0", interest: "0", handling_fees: "0", insurance: "0", adjustments: "0", refunds: "2500", payments: "10000", total_calculated: "99000" }),
        limit: () => query,
        order: () => table === "fx_rates" ? query : result(table === "statements" ? (fixture.saved ? [fixture.statement] : [])
          : table === "installments" ? [{ transaction_id: "parent", number: 2, total: "6.25", total_cop: "25000" }]
          : [...fixture.realInterest ? [movement("Intereses", "interest", "7100")] : [], movement("Mercado", "purchase", "12500"), movement("Música", "purchase", "15.99", { source: "subscription", currency: "USD", amount_cop: "64000" }), movement("Devolución", "refund", "2500"), movement("Pago", "payment", "10000")]),
        in: () => result([movement("parent", "purchase", "37.50", { merchant: "Compra en dólares", currency: "USD", installments_count: 6 })]),
      };
      return query;
    },
  }),
}));

async function renderPage() {
  return renderToStaticMarkup(await StatementDetailPage({ params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111", cutoff: "2026-11-15" }) }));
}

describe("statement page", () => {
  beforeEach(() => {
    fixture.saved = true;
    fixture.statement.paid_at = null;
    fixture.statement.real_total = null;
    fixture.interestMode = "per_installment";
    fixture.realInterest = false;
    estimates.load.mockReset();
  });

  it("adds the on-balance interest estimate to the calculated total and offers the real one (D32)", async () => {
    fixture.interestMode = "on_balance";
    const Decimal = (await import("decimal.js")).default;
    estimates.load.mockResolvedValue(new Map([["statement", { amountCop: new Decimal("7266.02"), byCurrency: { COP: new Decimal("7266.02"), USD: new Decimal(0) } }]]));
    const html = await renderPage();
    expect(html).toContain("$106.266");
    expect(html).toContain("Intereses estimados");
    expect(html).toContain("Incluye intereses estimados");
    expect(html).toContain("Formulario de intereses reales");
  });

  it("does not estimate per-installment cards nor offer the form once the real interest exists", async () => {
    expect(await renderPage()).not.toContain("Intereses estimados");
    expect(estimates.load).not.toHaveBeenCalled();
    fixture.interestMode = "on_balance";
    fixture.realInterest = true;
    estimates.load.mockResolvedValue(new Map());
    const html = await renderPage();
    expect(html).not.toContain("Formulario de intereses reales");
    expect(html).not.toContain("Intereses estimados");
  });

  it("preserves totals, grouped movements, USD installments, and separate payments", async () => {
    const html = await renderPage();
    expect(html).toContain("$99.000");
    expect(html).toContain("bg-card-3");
    expect(html).toContain("Visa de prueba · •••• 1234");
    expect(html).toContain("5 conceptos sin movimientos");
    expect(html).toContain("Música · 12 nov");
    expect(html).toContain("Compra en dólares · Cuota 2 de 6");
    expect(html).toContain("US$ 6,25");
    expect(html).toContain('href="/movimientos/parent"');
    expect(html).toContain('href="/movimientos/Pago"');
    expect(html.indexOf("Controles del extracto")).toBeLessThan(html.indexOf('id="statement-breakdown-title"'));
    expect(html).toContain('data-paid="false"');
  });

  it("passes the saved real total and paid state to the unchanged controls", async () => {
    fixture.statement.paid_at = "2026-11-12";
    fixture.statement.real_total = "99500.00";
    const html = await renderPage();
    expect(html).toContain('data-paid="true"');
    expect(html).toContain('data-real-total="99500.00"');
    expect(html).toContain("Pagado");
  });

  it("keeps an unsaved open statement empty without offering payment controls", async () => {
    fixture.saved = false;
    const html = await renderPage();
    expect(html).toContain("Aún no hay movimientos en este extracto.");
    expect(html).toContain("$0");
    expect(html).not.toContain("Controles del extracto");
    expect(html).not.toContain("<details");
  });
});
