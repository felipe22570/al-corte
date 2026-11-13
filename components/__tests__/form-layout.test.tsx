// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CardForm } from "@/components/card-form";
import { SelectControl } from "@/components/select-control";
import { SubscriptionForm } from "@/components/subscription-form";
import { TransactionForm } from "@/components/transaction-form";
import type { TransactionCardOption } from "@/lib/transaction-options";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions/cards", () => ({ createCard: vi.fn(), updateCard: vi.fn() }));
vi.mock("@/lib/actions/subscriptions", () => ({ createSubscription: vi.fn(), updateSubscription: vi.fn() }));
vi.mock("@/lib/actions/transactions", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }));

const cards: TransactionCardOption[] = [{ id: "11111111-1111-4111-8111-111111111111", name: "Visa principal", last4: "1234", color: "card-1", cutoffDay: 15, paymentDay: 30, purchaseRateEa: "0.2", advanceRateEa: "0.2", advanceFee: "0", amortizationMethod: "fixed_principal" }];

describe("form layout and actions", () => {
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

  function button(text: string) {
    return [...document.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent === text)!;
  }

  it("keeps a card chip inside the selected value and options without changing form data", async () => {
    await act(async () => root.render(<form><SelectControl name="card" value="visa" aria-label="Tarjeta" options={[{ value: "visa", label: "Visa principal", startAdornment: <span data-card-chip="true" /> }]} /></form>));
    const trigger = container.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    expect(trigger.querySelector("[data-card-chip]")).not.toBeNull();
    expect(trigger.textContent).toBe("Visa principal");
    expect(new FormData(container.querySelector("form")!).get("card")).toBe("visa");
    await act(async () => trigger.click());
    expect(document.querySelector('[role="option"] [data-card-chip]')).not.toBeNull();
  });

  it("shows transaction date and currency outside extra options, with adjacent footer actions", async () => {
    await act(async () => root.render(<TransactionForm userId="layout-test" cards={cards} categories={[]} today="2026-11-12" latestRate="4000" />));
    const amount = container.querySelector<HTMLInputElement>("#transaction-amount")!;
    expect(amount.className).toContain("text-left");
    expect(amount.className).toContain("text-amount-lg");
    expect(amount.parentElement?.textContent).toBe("$");
    expect(container.querySelector("#transaction-date")?.closest("details")).toBeNull();
    expect(container.querySelector("#transaction-currency")?.closest("details")).toBeNull();
    expect(container.querySelector("#transaction-card")?.textContent).toBe("Visa principal · •••• 1234");
    expect(button("Guardar").parentElement).toBe(button("Cancelar").parentElement);
    expect(button("Guardar").parentElement?.className).not.toContain("fixed");
  });

  it("groups subscription amount/currency and frequency/billing day and cancels without saving", async () => {
    await act(async () => root.render(<SubscriptionForm cards={cards} categories={[]} today="2026-11-12" />));
    await act(async () => button("Agregar suscripción").click());
    const amountGroup = document.querySelector("#subscription-amount")!.parentElement!.parentElement!.parentElement!;
    expect(amountGroup.contains(document.querySelector("#subscription-currency"))).toBe(true);
    const frequencyGroup = document.querySelector("#subscription-frequency")!.parentElement!.parentElement!;
    expect(frequencyGroup.contains(document.querySelector("#subscription-day"))).toBe(true);
    expect(button("Guardar").parentElement).toBe(button("Cancelar").parentElement);
    expect(button("Cancelar").type).toBe("button");
    await act(async () => button("Cancelar").click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps cutoff and payment in a two-column row and offers a non-submitting cancel", async () => {
    await act(async () => root.render(<CardForm usedColors={[]} />));
    await act(async () => button("Agregar tarjeta").click());
    const dateGroup = document.querySelector("#card-cutoffDay")!.parentElement!.parentElement!;
    expect(dateGroup.className).toContain("grid-cols-2");
    expect(dateGroup.contains(document.querySelector("#card-paymentDay"))).toBe(true);
    expect(button("Guardar").parentElement).toBe(button("Cancelar").parentElement);
    expect(button("Cancelar").type).toBe("button");
    await act(async () => button("Cancelar").click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
