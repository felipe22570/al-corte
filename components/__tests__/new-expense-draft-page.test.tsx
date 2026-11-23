import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewExpensePage, { generateMetadata } from "@/app/(app)/movimientos/nuevo/page";

const visa = "11111111-1111-4111-8111-111111111111";
const draftId = "55555555-5555-4555-8555-555555555555";
const mocks = vi.hoisted(() => ({ loadOpenDraft: vi.fn(), redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }), formProps: [] as unknown[] }));

function query(data: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "limit", "not"]) builder[method] = () => builder;
  builder.maybeSingle = async () => ({ data, error: null });
  builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
    from: (table: string) => query(table === "cards"
      ? [{ id: visa, name: "Visa", last4: "1999", color: "card-1", cutoff_day: 15, payment_day: 2, purchase_rate_ea: "0.2", advance_rate_ea: "0.2", advance_fee: "0", amortization_method: "fixed_principal", interest_mode: "on_balance", usd_default_installments: 36 }]
      : table === "fx_rates" ? { usd_cop: "3301.91" } : []),
  }),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/queries/drafts", () => ({ loadOpenDraft: mocks.loadOpenDraft }));
vi.mock("@/lib/queries/merchant-history", () => ({ loadMerchantHistory: async () => [] }));
vi.mock("@/lib/queries/statement-cutoffs", () => ({ loadRecentStatementCutoffs: async () => ({}) }));
vi.mock("@/lib/domain/dates", async (original) => ({ ...await original<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-22" }));
vi.mock("@/components/transaction-form", () => ({ TransactionForm: (props: unknown) => { mocks.formProps.push(props); return null; } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.formProps.length = 0;
});

describe("confirming a draft from Nuevo gasto (F18)", () => {
  it("prefills the form with the open draft", async () => {
    mocks.loadOpenDraft.mockResolvedValue({
      id: draftId, status: "pending", phrase: "Compraste COP140.910,00 en DIRECTV", cardId: visa, last4: "1999", type: "purchase", amount: "140910.00", currency: "COP",
      merchantRaw: "DIRECTV", occurredOn: "2026-11-17", suggestions: { billingCurrency: "COP", merchantName: null, categoryId: null, subscriptionId: null, installmentsCount: null, isInternational: null, confidence: "alta", reason: null },
    });
    const html = renderToStaticMarkup(await NewExpensePage({ searchParams: Promise.resolve({ borrador: draftId }) }));
    expect(html).toContain("Confirmar movimiento");
    expect(mocks.loadOpenDraft).toHaveBeenCalledWith(expect.anything(), "owner", draftId);
    expect(mocks.formProps[0]).toMatchObject({ captured: { id: draftId, last4: "1999", billingCurrency: null, unknownCard: false, values: { cardId: visa, amount: "140.910", merchant: "DIRECTV", date: "2026-11-17" } } });
  });

  it("marks a card that is not active as unknown", async () => {
    mocks.loadOpenDraft.mockResolvedValue({ id: draftId, status: "unknown_card", phrase: "x", cardId: null, last4: "0000", type: "purchase", amount: "1.00", currency: "COP", merchantRaw: "X", occurredOn: "2026-11-17", suggestions: null });
    renderToStaticMarkup(await NewExpensePage({ searchParams: Promise.resolve({ borrador: draftId }) }));
    expect(mocks.formProps[0]).toMatchObject({ captured: { unknownCard: true, values: { cardId: "" } } });
  });

  it("sends a resolved or invalid draft back to the inbox", async () => {
    mocks.loadOpenDraft.mockResolvedValue(null);
    await expect(NewExpensePage({ searchParams: Promise.resolve({ borrador: draftId }) })).rejects.toThrow("redirect:/por-confirmar");
    await expect(NewExpensePage({ searchParams: Promise.resolve({ borrador: "no-es-un-id" }) })).rejects.toThrow("redirect:/por-confirmar");
    expect(mocks.loadOpenDraft).toHaveBeenCalledTimes(1);
  });

  it("names the tab after what the page does", async () => {
    expect(await generateMetadata({ searchParams: Promise.resolve({ borrador: draftId }) })).toEqual({ title: "Confirmar movimiento" });
    expect(await generateMetadata({ searchParams: Promise.resolve({}) })).toEqual({ title: "Nuevo gasto" });
  });

  it("stays a normal expense form without a draft", async () => {
    const html = renderToStaticMarkup(await NewExpensePage({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Nuevo gasto");
    expect(mocks.formProps[0]).toMatchObject({ captured: undefined });
  });
});
