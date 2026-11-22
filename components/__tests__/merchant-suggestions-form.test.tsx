// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionForm } from "@/components/transaction-form";
import type { MerchantHistoryRow } from "@/lib/domain/merchant-suggestions";
import { encodeTransactionDraft, transactionDraftKey } from "@/lib/transaction-draft";
import type { TransactionCardOption } from "@/lib/transaction-options";
import type { TransactionInput } from "@/lib/validation/transaction";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions/transactions", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }));

const visaId = "11111111-1111-4111-8111-111111111111";
const masterId = "22222222-2222-4222-8222-222222222222";
const subsId = "33333333-3333-4333-8333-333333333333";
const foodId = "44444444-4444-4444-8444-444444444444";
const base = { color: "card-1" as const, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.2", advanceRateEa: "0.2", advanceFee: "0", amortizationMethod: "fixed_principal" as const, usdDefaultInstallments: 36 };
const cards: TransactionCardOption[] = [{ ...base, id: visaId, name: "Visa", last4: "1234" }, { ...base, id: masterId, name: "Mastercard", last4: "5678", color: "card-2" }];
const categories = [{ id: subsId, name: "Suscripciones", icon: "tv" }, { id: foodId, name: "Comida", icon: "utensils" }];
const history: MerchantHistoryRow[] = [
  { id: "netflix", merchant: "Netflix", cardId: visaId, date: "2026-11-07", createdAt: "2026-11-07T10:00:00Z", type: "purchase", categoryId: subsId, installmentsCount: 36, currency: "USD", isInternational: true, interestFree: false },
  { id: "rappi", merchant: "Rappi", cardId: masterId, date: "2026-11-10", createdAt: "2026-11-10T10:00:00Z", type: "purchase", categoryId: foodId, installmentsCount: 1, currency: "COP", isInternational: false, interestFree: false },
];

function setInput(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("sugerencias por comercio en el formulario (F20, D53)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
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

  const $ = <T extends Element = HTMLInputElement>(selector: string) => container.querySelector<T & Element>(selector)!;
  const field = (id: string) => $<HTMLInputElement>(`#${id}`);
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === text);
  const notice = () => [...container.querySelectorAll('[role="status"]')].map((element) => element.textContent).find((text) => text?.startsWith("Como tu"));
  const international = () => [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((element) => element.parentElement?.textContent === "Compra internacional")!;

  async function render(props: Partial<Parameters<typeof TransactionForm>[0]> = {}) {
    await act(async () => root.render(<TransactionForm userId="owner" cards={cards} categories={categories} today="2026-11-21" latestRate="3301.91" merchantHistory={history} {...props} />));
    await act(async () => { await Promise.resolve(); });
  }
  async function type(id: string, value: string) {
    await act(async () => setInput(field(id), value));
  }
  async function choose(id: string, label: string) {
    await act(async () => $<HTMLButtonElement>(`#${id}`).click());
    const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((element) => element.textContent === label)!;
    await act(async () => option.click());
  }

  it("offers recent merchants and applies the last purchase when one is picked", async () => {
    await render();
    expect([...container.querySelectorAll("#transaction-merchant-options option")].map((option) => option.getAttribute("value"))).toEqual(["Rappi", "Netflix"]);
    await type("transaction-merchant", "Netflix");
    expect(notice()).toBe("Como tu última compra en Netflix (7 nov)");
    expect($("#transaction-category").textContent).toBe("Suscripciones");
    expect($("#transaction-currency").textContent).toBe("USD");
    expect(field("transaction-rate").value).toBe("3301,91");
    expect(field("transaction-count").value).toBe("36");
    expect(international().checked).toBe(true);
  });

  it("names the other card and removes the suggestion, restoring the previous values", async () => {
    await render();
    await type("transaction-merchant", "Rappi");
    expect(notice()).toBe("Como tu última compra en Rappi con Mastercard (10 nov)");
    await act(async () => button("Quitar sugerencia")!.click());
    expect(notice()).toBeUndefined();
    expect($("#transaction-category").textContent).toBe("Sin categoría");
    await act(async () => { field("transaction-merchant").focus(); field("transaction-merchant").blur(); });
    expect(notice()).toBeUndefined();
  });

  it("matches normalized names when leaving the field and undoes it for unknown ones", async () => {
    await render();
    await type("transaction-merchant", " NÉTFLIX ");
    expect(notice()).toBeUndefined();
    await act(async () => { field("transaction-merchant").focus(); field("transaction-merchant").blur(); });
    expect(notice()).toBe("Como tu última compra en Netflix (7 nov)");
    await type("transaction-merchant", "Spotify");
    await act(async () => { field("transaction-merchant").focus(); field("transaction-merchant").blur(); });
    expect(notice()).toBeUndefined();
    expect($("#transaction-currency").textContent).toBe("COP");
    expect(field("transaction-count").value).toBe("1");
  });

  it("does not overwrite fields the owner already changed", async () => {
    await render();
    await choose("transaction-category", "Comida");
    await type("transaction-count", "3");
    await type("transaction-merchant", "Netflix");
    expect($("#transaction-category").textContent).toBe("Comida");
    expect(field("transaction-count").value).toBe("3");
    expect($("#transaction-currency").textContent).toBe("USD");
    await act(async () => button("Quitar sugerencia")!.click());
    expect($("#transaction-currency").textContent).toBe("COP");
    expect(field("transaction-count").value).toBe("3");
  });

  it("replaces the USD default installments (D34), which the owner did not choose", async () => {
    await render({ merchantHistory: [{ ...history[0]!, installmentsCount: 1 }] });
    await choose("transaction-currency", "USD");
    expect(field("transaction-count").value).toBe("36");
    await type("transaction-merchant", "Netflix");
    expect(field("transaction-count").value).toBe("1");
    expect(field("transaction-rate").value).toBe("3301,91");
  });

  it("treats a restored draft as touched", async () => {
    const draft: TransactionInput = { cardId: visaId, type: "purchase", date: "2026-11-21", amount: "15", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, isInternational: false, advanceFee: "", categoryId: "", merchant: "", note: "", inProgress: false, currentInstallment: "", balanceAfter: "", trackedFromCutoff: "" };
    sessionStorage.setItem(transactionDraftKey("owner"), encodeTransactionDraft(draft, "new"));
    await render();
    await type("transaction-merchant", "Netflix");
    expect(notice()).toBeUndefined();
    expect($("#transaction-currency").textContent).toBe("COP");
  });

  it("changes the suggestion when the card changes", async () => {
    await render({ merchantHistory: [history[0]!, { ...history[0]!, id: "netflix-master", cardId: masterId, date: "2026-10-07", installmentsCount: 12 }] });
    await type("transaction-merchant", "Netflix");
    expect(field("transaction-count").value).toBe("36");
    await choose("transaction-card", "Mastercard · •••• 5678");
    expect(notice()).toBe("Como tu última compra en Netflix (7 oct)");
    expect(field("transaction-count").value).toBe("12");
  });

  it("does not suggest while editing a movement", async () => {
    const initial: TransactionInput = { cardId: visaId, type: "purchase", date: "2026-11-21", amount: "15", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, isInternational: false, advanceFee: "", categoryId: "", merchant: "", note: "", inProgress: false, currentInstallment: "", balanceAfter: "", trackedFromCutoff: "" };
    await render({ edit: { id: "movement", initial, original: { cardId: visaId, type: "purchase", rateEaApplied: "0.2" }, hasPaidInstallments: false } });
    expect(container.querySelector("#transaction-merchant-options")).toBeNull();
    await type("transaction-merchant", "Netflix");
    expect(notice()).toBeUndefined();
  });
});
