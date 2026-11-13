import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SubscriptionsPage from "@/app/(app)/suscripciones/page";

const { data } = vi.hoisted(() => ({ data: { subscriptions: [] as object[] } }));
vi.mock("@/components/subscription-form", () => ({ SubscriptionForm: () => <button>Editar</button> }));
vi.mock("@/components/subscription-status-actions", () => ({ SubscriptionStatusActions: () => <button>Más opciones</button> }));
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-12" }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  from: (table: string) => {
    const result = { data: table === "subscriptions" ? data.subscriptions : table === "cards" ? [{ id: "visa", name: "Visa", color: "card-1", last4: "1234", archived_at: null }] : table === "fx_rates" ? { usd_cop: "4000" } : [], error: null };
    const query = {
      select: () => query, eq: () => query, is: () => query, order: () => query, limit: () => query, in: () => query,
      maybeSingle: async () => result,
      then: (resolve: (value: typeof result) => void) => Promise.resolve(result).then(resolve),
    };
    return query;
  },
}) }));

const raw = { card_id: "visa", category_id: null, amount: "15000", currency: "COP", frequency: "monthly", billing_day: 15, start_date: "2026-10-15", trial_ends_at: null };

describe("subscription page progressive disclosure", () => {
  beforeEach(() => { data.subscriptions = []; });

  it("keeps cancelled subscriptions in a closed section after the current list", async () => {
    data.subscriptions = [
      { ...raw, id: "cancelled", name: "Cancelada de ejemplo", status: "cancelled" },
      { ...raw, id: "active", name: "Activa de ejemplo", status: "active", trial_ends_at: "2026-11-15" },
      { ...raw, id: "paused", name: "Pausada de ejemplo", status: "paused" },
    ];
    const html = renderToStaticMarkup(await SubscriptionsPage());
    const split = html.indexOf("<details");
    expect(html.slice(0, split)).toContain("Activa de ejemplo");
    expect(html.slice(0, split)).toContain("Pausada de ejemplo");
    expect(html.slice(0, split)).not.toContain("Cancelada de ejemplo");
    expect(html.slice(split)).toContain("Canceladas (1)");
    expect(html.slice(split)).toContain("Cancelada de ejemplo");
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    expect(html).toContain("Prueba hasta el 15 nov");
    expect(html).not.toContain("Pruebas por vencer");
    expect(html).toContain("$15.000");
    expect(html).toContain("$180.000");
  });

  it("does not imply the list is empty when only cancelled subscriptions remain", async () => {
    data.subscriptions = [{ ...raw, id: "cancelled", name: "Cancelada de ejemplo", status: "cancelled" }];
    const html = renderToStaticMarkup(await SubscriptionsPage());
    expect(html).toContain("No tienes suscripciones activas ni pausadas.");
    expect(html).toContain("Canceladas (1)");
    expect(html).not.toContain("Aún no tienes suscripciones.");
  });

  it("omits the cancelled section when there are no cancelled subscriptions", async () => {
    data.subscriptions = [{ ...raw, id: "active", name: "Activa de ejemplo", status: "active" }];
    const html = renderToStaticMarkup(await SubscriptionsPage());
    expect(html).not.toContain("Canceladas (");
  });
});
