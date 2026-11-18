import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import CardDetailPage from "@/app/(app)/tarjetas/[id]/page";

vi.mock("@/lib/domain/dates", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/domain/dates")>(),
  todayInBogota: () => "2026-11-13",
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (table: string) => {
      const data: Record<string, unknown> = {
        cards: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Visa principal", bank: "Banco de prueba", last4: "1234", color: "card-1", cutoff_day: 15, payment_day: 2 },
        card_balances: { available: "-999999999999", utilization: "1.25" },
        statements: [
          { id: "past", period_start: "2026-09-16", cutoff_date: "2026-10-15", due_date: "2026-11-02" },
          { id: "open", period_start: "2026-10-16", cutoff_date: "2026-11-15", due_date: "2026-12-02" },
          { id: "next", period_start: "2026-11-16", cutoff_date: "2026-12-15", due_date: "2027-01-02" },
        ],
        statement_currency_totals: ["past", "open", "next"].flatMap((statement_id) => [
          { statement_id, currency: "COP", has_charges: true, total_calculated: "999999999999", total_cop: "999999999999", pending_principal: "0", total_debt: "999999999999" },
          { statement_id, currency: "USD", has_charges: true, total_calculated: "999999999999.99", total_cop: "999999999999", pending_principal: "0", total_debt: "999999999999.99" },
        ]),
        statement_balances: [],
        transactions: [{ id: "purchase", merchant: "Compra con un nombre largo para comprobar el ajuste en pantallas pequeñas", currency: "USD", installments_count: 2 }],
        installments: ["open", "next"].map((statement_id, index) => ({ transaction_id: "purchase", statement_id, number: index + 1, principal: "999999999999.99", interest: "0", total: "999999999999.99", balance_after: "999999999999.99", principal_cop: "999999999999", interest_cop: "0", total_cop: "999999999999" })),
      };
      const result = Promise.resolve({ data: data[table], error: null });
      const query = Object.assign(result, {
        select: () => query, eq: () => query, gt: () => query, in: () => query, order: () => query, maybeSingle: () => query, range: () => query,
      });
      return query;
    },
  }),
}));

describe("card detail with extreme amounts", () => {
  it("uses the same over-limit presentation and lets statement rows wrap", async () => {
    const html = renderToStaticMarkup(await CardDetailPage({ params: Promise.resolve({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }) }));
    expect(html).toContain("Sobrecupo de ");
    expect(html).toContain("bg-card-1");
    expect(html).toContain("Banco de prueba · •••• 1234");
    expect(html).toContain("bg-danger-soft");
    expect(html).not.toContain("-$");
    expect(html).toContain("$999.999.999.999");
    // D33: dollars never add to pesos; they appear apart as "y US$".
    expect(html).toMatch(/y <span class="text-amount[^"]*"[^>]*>US\$ 999\.999\.999\.999,99/);
    expect(html).toContain("US$ 999.999.999.999,99");
    expect(html).toContain("Capital pendiente:");
    expect(html).toMatch(/class="[^"]*flex-wrap[^>]*>[\s\S]*Corte 15 oct/);
    expect(html).not.toContain('class="shrink-0 text-right"');
  });
});
