import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import SettingsPage from "@/app/(app)/ajustes/page";
import CardDetailPage from "@/app/(app)/tarjetas/[id]/page";

const id = "11111111-1111-4111-8111-111111111111";
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-13" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  from: (table: string) => {
    const card = { id: "11111111-1111-4111-8111-111111111111", name: "Visa principal", bank: "Banco de prueba", network: "Visa", last4: "1234", color: "card-1", archived_at: null, credit_limit: "5000000", advance_fee: "0", handling_fee: "15000", cutoff_day: 15, payment_day: 30, purchase_rate_ea: "0.25", advance_rate_ea: "0.28", amortization_method: "fixed_principal" };
    const result = {
      data: table === "cards" ? [card]
        : table === "categories" ? [{ id: "food", name: "Restaurantes", icon: "utensils", archived_at: null }]
        : table === "card_balances" ? { available: "3750000", utilization: "0.25" }
        : table === "statements" ? [
          { id: "open", period_start: "2026-10-16", cutoff_date: "2026-11-15", due_date: "2026-11-30", paid_at: null },
          { id: "next", period_start: "2026-11-16", cutoff_date: "2026-12-15", due_date: "2026-12-30", paid_at: null },
        ]
        : table === "statement_totals" ? [{ statement_id: "open", total_calculated: "1250000" }, { statement_id: "next", total_calculated: "240000" }] : [],
      error: null,
    };
    const query = {
      select: () => query, eq: () => query, order: () => query, gt: () => query,
      maybeSingle: async () => ({ ...result, data: table === "cards" ? card : result.data }),
      then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
    };
    return query;
  },
}) }));

describe("distilled settings and card details", () => {
  it("keeps appearance and session separate without losing settings content", async () => {
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain('id="appearance-title"');
    expect(html).toContain("Apariencia");
    expect(html).toContain('aria-label="Tema de apariencia"');
    expect(html).toContain('id="session-title"');
    expect(html).toContain("Cerrar sesión");
    expect(html).toContain("Corte el 15 · Pago el 30 · Compras: 25,00% E.A.");
    expect(html).toContain("$5.000.000");
    expect(html).toContain("Restaurantes");
  });

  it("uses matching add controls and matching edit/archive hierarchy", async () => {
    const html = renderToStaticMarkup(await SettingsPage());
    const buttons = [...html.matchAll(/<button\b[^>]*class="([^"]*)"[^>]*>([^<]+)<\/button>/g)];
    const classes = (name: string) => buttons.filter((button) => button[2] === name).map((button) => button[1]);
    expect(classes("Agregar tarjeta")).toEqual(classes("Agregar categoría"));
    expect(classes("Editar")).toHaveLength(2);
    expect(classes("Editar")).toEqual(classes("Archivar"));
    const link = html.match(/<a\b[^>]*href="[^"]*\/tarjetas\/[^"]*"[^>]*>/)?.[0] ?? html.match(/<a\b[^>]*class="[^"]*"[^>]*href="\/tarjetas\/[^"]*"[^>]*>/)?.[0];
    expect(link).toContain("hover:underline");
    expect(link).not.toMatch(/(?:class="|\s)underline(?:\s|")/);
  });

  it("prioritizes the open statement and keeps historical statement links and balances", async () => {
    const html = renderToStaticMarkup(await CardDetailPage({ params: Promise.resolve({ id }) }));
    expect(html.indexOf("Extracto abierto")).toBeLessThan(html.indexOf("Cupo disponible"));
    expect(html).toContain("$1.250.000");
    expect(html).toContain("$3.750.000");
    expect(html).toContain(`href="/tarjetas/${id}/extractos/2026-12-15"`);
    expect(html).toContain("No tienes compras a cuotas activas.");
    expect(html).not.toContain("rounded-xl");
  });
});
