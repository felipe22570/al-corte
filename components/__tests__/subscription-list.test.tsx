import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SubscriptionList, type SubscriptionCharge } from "@/components/subscription-list";
import type { SubscriptionRecord } from "@/lib/subscription-types";

vi.mock("@/components/subscription-form", () => ({ SubscriptionForm: () => <button>Editar</button> }));
vi.mock("@/components/subscription-status-actions", () => ({ SubscriptionStatusActions: () => <button>Más opciones</button> }));

const subscription: SubscriptionRecord = { id: "music", name: "Música", cardId: "visa", categoryId: null, amount: "15990", currency: "COP", frequency: "monthly", billingDay: 15, startDate: "2026-10-15", trialEndsAt: null, status: "active" };
const cards = [{ id: "visa", name: "Visa", color: "card-1" as const, last4: "1234" }];
function render(item: SubscriptionRecord, charges: SubscriptionCharge[] = []) {
  return renderToStaticMarkup(<SubscriptionList subscriptions={[item]} cards={cards} activeCards={cards} categories={[]} charges={charges} today="2026-11-12" />);
}

describe("compact subscription list", () => {
  it("keeps the name, card, frequency and next charge with a right-aligned amount and visible edit", () => {
    const html = render(subscription);
    for (const text of ["Música", "Visa · •••• 1234", "Mensual", "próximo cobro 15 nov", "$15.990", "Editar", "Más opciones"]) expect(html).toContain(text);
    expect(html).toContain('class="text-right"');
    expect(html).toContain("minmax(0,1fr)");
  });

  it("keeps trial warnings inside the subscription row with intrinsic badge width", () => {
    const html = render({ ...subscription, trialEndsAt: "2026-11-15" });
    expect(html).toContain("Prueba hasta el 15 nov");
    expect(html).toContain("bg-warning-soft text-warning");
    expect(html).toContain("w-fit max-w-full");
    expect(html).not.toContain("Pruebas por vencer");
    expect(render({ ...subscription, trialEndsAt: "2026-11-30" })).not.toContain("Prueba hasta");
    expect(render({ ...subscription, trialEndsAt: "2026-11-15", status: "paused" })).not.toContain("Prueba hasta");
  });

  it("shows paused state without suggesting another automatic charge", () => {
    const html = render({ ...subscription, status: "paused" });
    expect(html).toContain("Pausada");
    expect(html).not.toContain("próximo cobro");
  });

  it("preserves recent charge links behind a closed disclosure", () => {
    const html = render(subscription, [{ id: "charge", subscription_id: "music", date: "2026-11-12", amount: "15990", currency: "COP" }]);
    expect(html).toContain("Últimos cobros");
    expect(html).toContain('href="/movimientos/charge"');
    expect(html).not.toMatch(/<details[^>]*\sopen/);
  });

  it("does not project a second charge today when one already exists", () => {
    const html = render({ ...subscription, billingDay: 12 }, [{ id: "charge", subscription_id: "music", date: "2026-11-12", amount: "15990", currency: "COP" }]);
    expect(html).toContain("próximo cobro 12 dic");
  });
});
