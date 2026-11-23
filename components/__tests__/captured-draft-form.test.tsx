// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionForm, type CapturedDraft } from "@/components/transaction-form";
import { draftFormStart } from "@/lib/draft-form";
import type { MerchantHistoryRow } from "@/lib/domain/merchant-suggestions";
import type { TransactionCardOption } from "@/lib/transaction-options";

const mocks = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), confirmDraft: vi.fn(), createTransaction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/lib/actions/transactions", () => ({ createTransaction: mocks.createTransaction, updateTransaction: vi.fn() }));
vi.mock("@/lib/actions/drafts", () => ({ confirmDraft: mocks.confirmDraft }));

const visaId = "11111111-1111-4111-8111-111111111111";
const subsId = "33333333-3333-4333-8333-333333333333";
const draftId = "55555555-5555-4555-8555-555555555555";
const base = { color: "card-1" as const, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.2", advanceRateEa: "0.2", advanceFee: "0", amortizationMethod: "fixed_principal" as const, usdDefaultInstallments: 36 };
const cards: TransactionCardOption[] = [{ ...base, id: visaId, name: "Visa", last4: "1999" }];
const categories = [{ id: subsId, name: "Suscripciones", icon: "tv" }];
const history: MerchantHistoryRow[] = [
  { id: "netflix", merchant: "Netflix", cardId: visaId, date: "2026-11-07", createdAt: "2026-11-07T10:00:00Z", type: "purchase", categoryId: subsId, installmentsCount: 36, currency: "USD", isInternational: true, interestFree: false },
];
const context = { cardIds: [visaId], categoryIds: [subsId], today: "2026-11-22", latestRate: "3301.91" };

function captured(change: Partial<Parameters<typeof draftFormStart>[0]> = {}, extra: Partial<CapturedDraft> = {}): CapturedDraft {
  const start = draftFormStart({ cardId: visaId, type: "purchase", amount: "44900.00", currency: "COP", merchantRaw: "NETFLIX", occurredOn: "2026-11-18", suggestions: null, ...change }, context);
  return { id: draftId, phrase: "Compraste COP44.900,00 en NETFLIX", last4: "1999", billingCurrency: null, unknownCard: false, ...start, ...extra };
}

describe("confirming a captured draft in the expense form (F18)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const field = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!;
  const text = () => container.textContent ?? "";
  const submitButton = () => [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === "Confirmar movimiento")!;

  async function render(draft: CapturedDraft) {
    await act(async () => root.render(<TransactionForm userId="owner" cards={cards} categories={categories} today="2026-11-22" latestRate="3301.91" merchantHistory={history} captured={draft} />));
    await act(async () => { await Promise.resolve(); });
  }

  it("keeps the alert facts and lets merchant history fill only the free fields", async () => {
    // The last card used must not replace the alert card.
    localStorage.setItem("al-corte:last-card-id", "otra");
    await render(captured());
    expect(field("transaction-amount").value).toBe("44.900");
    expect(field("transaction-merchant").value).toBe("NETFLIX");
    expect(container.querySelector("#transaction-currency")!.textContent).toBe("COP");
    expect(container.querySelector("#transaction-card")!.textContent).toContain("1999");
    expect(container.querySelector("#transaction-category")!.textContent).toBe("Suscripciones");
    expect(field("transaction-count").value).toBe("36");
    expect(text()).toContain("Como tu última compra en Netflix");
    expect(text()).toContain("Del correo: «Compraste COP44.900,00 en NETFLIX»");
  });

  it("does not let history replace what AI already suggested", async () => {
    const suggestions = { merchantName: null, categoryId: null, subscriptionId: null, billingCurrency: null, installmentsCount: 1, isInternational: false, confidence: "alta" as const, reason: null };
    await render(captured({ suggestions }));
    expect(field("transaction-count").value).toBe("1");
    expect(container.querySelector("#transaction-category")!.textContent).toBe("Suscripciones");
  });

  it("confirms the draft instead of creating a separate movement", async () => {
    mocks.confirmDraft.mockResolvedValue({ ok: true, id: "tx" });
    await render(captured({ merchantRaw: "TIENDA" }));
    await act(async () => submitButton().click());
    expect(mocks.createTransaction).not.toHaveBeenCalled();
    expect(mocks.confirmDraft).toHaveBeenCalledTimes(1);
    expect(mocks.confirmDraft.mock.calls[0]![0]).toBe(draftId);
    expect(mocks.confirmDraft.mock.calls[0]![1]).toMatchObject({ cardId: visaId, amount: "44.900", currency: "COP", date: "2026-11-18", merchant: "TIENDA" });
    expect(mocks.push).toHaveBeenCalledWith("/por-confirmar?notice=confirmed");
  });

  it("shows the server error and stays on the form when the draft is gone", async () => {
    mocks.confirmDraft.mockResolvedValue({ ok: false, error: "Este movimiento ya no está por confirmar." });
    await render(captured({ merchantRaw: "TIENDA" }));
    await act(async () => submitButton().click());
    expect(text()).toContain("Este movimiento ya no está por confirmar.");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("asks for the card when the alert card is not registered and shows the billing currency hint", async () => {
    await render(captured({ cardId: null, merchantRaw: "GOOGLE *ChatGPT" }, { unknownCard: true, last4: "0000", billingCurrency: "USD" }));
    expect(text()).toContain("La tarjeta •••• 0000 no está registrada.");
    expect(container.querySelector("#transaction-card")!.textContent).toBe("Elige una tarjeta");
    expect(text()).toContain("Sugerido: este cobro puede facturarse en USD.");
    expect(container.querySelector("#transaction-currency")!.textContent).toBe("COP");
  });
});
