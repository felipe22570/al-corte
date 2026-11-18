import { renderToStaticMarkup } from "react-dom/server";
import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StatementDetailPage from "./page";

const fixture = vi.hoisted(() => ({
  statement: { id: "statement", period_start: "2026-10-16", cutoff_date: "2026-11-15", due_date: "2026-11-30" },
  saved: true,
  interestMode: "per_installment",
  realInterest: false,
  marks: [] as Array<Record<string, unknown>>,
  totals: [] as Array<Record<string, unknown>>,
}));
const estimates = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/queries/interest-estimates", () => ({ loadInterestEstimates: estimates.load }));
vi.mock("@/components/statement-interest-form", () => ({ StatementInterestForm: () => <div>Formulario de intereses reales</div> }));
vi.mock("@/lib/domain/dates", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/domain/dates")>(),
  todayInBogota: () => "2026-11-12",
}));
vi.mock("@/components/statement-balance-controls", () => ({
  StatementBalanceControls: ({ currency, paid, realMinimum, context }: { currency: string; paid: boolean; realMinimum: string | null; context: string }) => <div data-currency={currency} data-paid={String(paid)} data-real-minimum={realMinimum} data-context={context}>Controles {currency}</div>,
}));
const zeros = { single_purchases: "0", installments: "0", subscriptions: "0", cash_advances: "0", interest: "0", handling_fees: "0", insurance: "0", adjustments: "0", refunds: "0", payments: "0" };
const copTotals = { ...zeros, statement_id: "statement", currency: "COP", has_charges: true, single_purchases: "12500", subscriptions: "64000", refunds: "2500", payments: "10000", total_calculated: "74000", total_cop: "74000", pending_principal: "300000", total_debt: "374000" };
const usdTotals = { ...zeros, statement_id: "statement", currency: "USD", has_charges: true, installments: "6.25", total_calculated: "6.25", total_cop: "25000", pending_principal: "25", total_debt: "31.25" };
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (table: string) => {
      const movement = (id: string, type: string, amount: string, extra = {}) => ({ id, type, source: "manual", merchant: id, date: "2026-11-12", currency: "COP", amount, amount_cop: amount, installments_count: 1, ...extra });
      const result = (data: unknown) => Promise.resolve({ data, error: null });
      const query = {
        select: () => query,
        eq: () => query,
        in: () => table === "transactions" ? result([movement("parent", "purchase", "37.50", { merchant: "Compra en dólares", currency: "USD", installments_count: 6 })]) : query,
        range: () => result(table === "statement_balances" ? fixture.marks : table === "statement_currency_totals" ? fixture.totals : []),
        maybeSingle: () => result(table === "cards"
          ? { id: "11111111-1111-4111-8111-111111111111", name: "Visa de prueba", color: "card-3", last4: "1234", cutoff_day: 15, payment_day: 30, interest_mode: fixture.interestMode, archived_at: null }
          : table === "statements" ? (fixture.saved ? fixture.statement : null)
          : table === "fx_rates" ? { usd_cop: "4000" } : null),
        limit: () => query,
        order: () => ["statement_balances", "statement_currency_totals", "fx_rates"].includes(table) ? query : result(table === "statements" ? (fixture.saved ? [fixture.statement] : [])
          : table === "installments" ? [{ transaction_id: "parent", number: 2, total: "6.25", total_cop: "25000" }]
          : [...fixture.realInterest ? [movement("Intereses", "interest", "7100")] : [], movement("Mercado", "purchase", "12500"), movement("Música", "purchase", "64000", { source: "subscription" }), movement("Devolución", "refund", "2500"), movement("Pago", "payment", "10000")]),
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
    fixture.interestMode = "per_installment";
    fixture.realInterest = false;
    fixture.marks = [];
    fixture.totals = [copTotals, usdTotals];
    estimates.load.mockReset();
  });

  it("shows minimum payment and total debt per currency, with USD apart from pesos (D33)", async () => {
    const html = await renderPage();
    expect(html).toContain("Pago mínimo");
    expect(html).toContain("$74.000");
    expect(html).toContain("y <span");
    expect(html).toContain("US$ 6,25");
    expect(html).toContain("$374.000");
    expect(html).toContain("US$ 31,25");
    expect(html).toContain("Equivalente en pesos (referencia)");
    expect(html).toContain("Desglose en pesos");
    expect(html).toContain("Desglose en dólares");
    expect(html).toContain('id="statement-breakdown-title-usd"');
    expect(html).toContain("Compra en dólares · Cuota 2 de 6");
    expect(html).toContain("Música · 12 nov");
    expect(html).toContain('href="/movimientos/Pago"');
    expect(html).toContain('data-currency="COP"');
    expect(html).toContain('data-context="Visa de prueba · •••• 1234 · corte 15 nov · dólares"');
    expect(html).toContain("bg-card-3");
  });

  it("marks the statement paid only when every currency with charges is marked", async () => {
    fixture.marks = [{ statement_id: "statement", currency: "COP", real_minimum: "74001", real_total: "374000.5", paid_at: "2026-11-12T05:00:00Z" }];
    let html = await renderPage();
    expect(html).toContain('data-currency="COP" data-paid="true" data-real-minimum="74001"');
    expect(html).toContain('data-currency="USD" data-paid="false"');
    expect(html).not.toContain(">Pagado<");
    expect(html).toContain("Pago mínimo del banco");
    expect(html).not.toContain("Diferencia");
    fixture.marks = [...fixture.marks, { statement_id: "statement", currency: "USD", real_minimum: "9", real_total: null, paid_at: "2026-11-12T05:00:00Z" }];
    html = await renderPage();
    expect(html).toContain("Pagado");
    expect(html).toContain("Diferencia: +US$ 2,75");
  });

  it("leads with dollars when the statement has no peso charges", async () => {
    fixture.totals = [usdTotals];
    const html = await renderPage();
    expect(html).toContain("US$ 6,25");
    expect(html).not.toContain("En pesos");
    expect(html).not.toContain('data-currency="COP"');
    expect(html).not.toContain("Desglose en pesos");
  });

  it("keeps an unsaved open statement empty without offering payment controls", async () => {
    fixture.saved = false;
    const html = await renderPage();
    expect(html).toContain("Aún no hay movimientos en este extracto.");
    expect(html).toContain("$0");
    expect(html).not.toContain("Controles");
    expect(html).not.toContain("<details");
  });

  it("adds the on-balance interest estimate to the minimum payment and offers the real one (D32)", async () => {
    fixture.interestMode = "on_balance";
    estimates.load.mockResolvedValue(new Map([["statement", { amountCop: new Decimal("7266.02"), byCurrency: { COP: new Decimal("7266.02"), USD: new Decimal(0) }, copByCurrency: { COP: new Decimal("7266.02"), USD: new Decimal(0) } }]]));
    const html = await renderPage();
    expect(html).toContain("$81.266");
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
});
