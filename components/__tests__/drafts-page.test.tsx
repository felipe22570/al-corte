import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import DraftsPage from "@/app/(app)/por-confirmar/page";
import type { InboxDraft } from "@/lib/queries/drafts";

const visa = "11111111-1111-4111-8111-111111111111";
const subs = "33333333-3333-4333-8333-333333333333";
const { state } = vi.hoisted(() => ({ state: { drafts: [] as unknown[] } }));
const table = (data: unknown[]) => ({ select: () => ({ eq: async () => ({ data, error: null }) }) });
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (name: string) => table(name === "cards" ? [{ id: visa, name: "Visa", last4: "1999" }] : [{ id: subs, name: "Suscripciones" }]),
  }),
}));
vi.mock("@/lib/queries/drafts", () => ({ loadOpenDrafts: async () => state.drafts }));
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-22" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }), redirect: vi.fn() }));

const base: InboxDraft = {
  id: "d1", status: "pending", phrase: "Compraste COP140.910,00 en DIRECTV, el 17/11/2026 a las 12:27", cardId: visa, last4: "1999", type: "purchase",
  amount: "140910.00", currency: "COP", merchantRaw: "DIRECTV", occurredOn: "2026-11-17", occurredTime: "12:27", statementCutoff: "2026-12-15",
  suggestions: null, createdAt: "2026-11-17T17:30:00Z", candidates: [], subscription: null,
};

async function render(drafts: InboxDraft[]) {
  state.drafts = drafts;
  return renderToStaticMarkup(await DraftsPage());
}

describe("Por confirmar (F18)", () => {
  it("says when there is nothing to confirm", async () => {
    expect(await render([])).toContain("No tienes movimientos por confirmar.");
  });

  it("shows the alert facts, the phrase and the tentative statement", async () => {
    const html = await render([base]);
    expect(html).toContain("DIRECTV");
    expect(html).toContain("17 nov · 12:27 · Visa •••• 1999");
    expect(html).toContain("$140.910");
    expect(html).toContain("Del correo: «Compraste COP140.910,00 en DIRECTV, el 17/11/2026 a las 12:27»");
    expect(html).toContain("Iría al extracto con corte del 15 dic.");
    expect(html).toContain('href="/movimientos/nuevo?borrador=d1"');
    expect(html).not.toContain("Sugerido");
  });

  it("marks AI suggestions as such and warns about a subscription amount change", async () => {
    const html = await render([{
      ...base,
      suggestions: { merchantName: "DirecTV", categoryId: subs, subscriptionId: null, billingCurrency: "USD", installmentsCount: 36, isInternational: true, confidence: "media", reason: "Cobro recurrente" },
      subscription: { name: "DirecTV", change: { charged: "140910.00", expected: "83350.00", currency: "COP" } },
    }]);
    expect(html).toContain("Sugerido · confianza media");
    expect(html).toContain("Nombre: DirecTV · Categoría: Suscripciones · 36 cuotas · Puede facturarse en USD · Compra internacional");
    expect(html).toContain("Cobro recurrente");
    expect(html).toContain("DirecTV cobró $140.910; tu suscripción dice $83.350.");
  });

  it("labels unknown cards and drafts to review with neutral badges and offers the same movement", async () => {
    const html = await render([
      { ...base, id: "d2", status: "unknown_card", cardId: null, last4: "0000", statementCutoff: null },
      { ...base, id: "d3", status: "needs_review", amount: null, currency: null, merchantRaw: null, subscription: { name: "Netflix", change: null },
        candidates: [{ id: "t1", cardId: visa, amount: "140910.00", currency: "COP", date: "2026-11-17", merchant: "DirecTV", linked: false }] },
    ]);
    expect(html).toContain("Tarjeta no registrada");
    expect(html).toContain("•••• 0000");
    expect(html).toContain("Revisar");
    expect(html).toContain("bg-secondary");
    expect(html).not.toMatch(/bg-(warning|danger|primary)-soft/);
    expect(html).toContain("Movimiento sin leer");
    expect(html).toContain("Sin valor");
    expect(html).toContain("Parece el cobro de tu suscripción Netflix.");
    expect(html).toContain("Ya tienes uno igual: DirecTV · 17 nov · $140.910");
    expect(html).toContain("Es el mismo");
  });
});
