// @vitest-environment jsdom

import Decimal from "decimal.js";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CreditAvailability } from "@/components/credit-availability";
import { ExchangeDifference } from "@/components/exchange-difference";
import { StatementPaymentForm } from "@/components/statement-payment-form";
import type { PaymentPreview } from "@/lib/payment-types";

const actions = vi.hoisted(() => ({ previewPayment: vi.fn(), registerPayment: vi.fn() }));
vi.mock("@/lib/actions/payments", () => actions);
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const d = (value: string | number) => new Decimal(value);

describe("diferencia cambiaria (F23, D56)", () => {
  it("cuenta cuánto más o menos costó el dólar frente a la TRM de cada compra", () => {
    expect(renderToStaticMarkup(<ExchangeDifference paidUsd={d(154)} paidCop={d(510000)} chargesUsd={d(154)} chargesCop={d(489000)} />))
      .toBe('<p class="text-small text-muted-foreground">Pagaste $510.000 por US$ 154,00; con la TRM de cada compra eran $489.000: el dólar te costó $21.000 más.</p>');
    expect(renderToStaticMarkup(<ExchangeDifference paidUsd={d(77)} paidCop={d(240000)} chargesUsd={d(154)} chargesCop={d(489000)} />)).toContain("el dólar te costó $4.500 menos.");
    expect(renderToStaticMarkup(<ExchangeDifference paidUsd={d(154)} paidCop={d("489000.4")} chargesUsd={d(154)} chargesCop={d(489000)} />)).toContain("el dólar te costó lo mismo.");
    expect(renderToStaticMarkup(<ExchangeDifference paidUsd={d(0)} paidCop={d(0)} chargesUsd={d(154)} chargesCop={d(489000)} />)).toBe("");
    expect(renderToStaticMarkup(<ExchangeDifference paidUsd={d(10)} paidCop={d(33000)} chargesUsd={d(0)} chargesCop={d(0)} />)).toBe("");
  });
});

describe("cupo con la deuda en dólares (D52)", () => {
  it("dice con qué TRM valoró los dólares, o que es estimado sin TRM", () => {
    expect(renderToStaticMarkup(<CreditAvailability value="10503698.38" fx={{ usdNet: "153.26", rate: "3461.92", estimated: false }} />)).toContain("Dólares con la TRM de 3.461,9200");
    expect(renderToStaticMarkup(<CreditAvailability value="100" fx={{ usdNet: "10", rate: null, estimated: true }} />)).toContain("Cupo estimado con la TRM de cada compra");
    expect(renderToStaticMarkup(<CreditAvailability value="-5000" fx={{ usdNet: "10", rate: "4000", estimated: false }} />)).toContain("Dólares con la TRM de 4.000,0000");
    expect(renderToStaticMarkup(<CreditAvailability value="100" fx={{ usdNet: "0", rate: "4000", estimated: false }} />)).not.toContain("TRM");
  });
});

describe("pago en dólares con pesos (F23)", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((item) => item.textContent === text)!;
  function type(input: HTMLInputElement, value: string) {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  it("pide los pesos debitados, muestra la tasa del banco y los envía con el pago", async () => {
    const preview: PaymentPreview = {
      kind: "minimum", currency: "USD", rule: "bancolombia_priority", effect: "reduce_term", amount: "153.26", pending: "153.26", minimumAmount: "154", totalAmount: null,
      toMinimum: "153.26", coversMinimum: true, prepayable: "0", allocatable: "0", leftover: "0", candidates: [], prepayments: [],
    };
    actions.previewPayment.mockResolvedValue({ ok: true, preview });
    actions.registerPayment.mockResolvedValue({ ok: true, markedPaid: true });
    await act(async () => root.render(<StatementPaymentForm statementId="s" currency="USD" today="2026-12-01" context="Mastercard · corte 15 nov" />));
    await act(async () => button("Registrar pago").click());
    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    const check = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((item) => item.parentElement?.textContent?.startsWith("Pagué con pesos"))!;
    await act(async () => check.click());
    expect(button("Guardar pago").disabled).toBe(true);
    const pesos = [...container.querySelectorAll<HTMLInputElement>("input")].find((item) => item.labels?.[0]?.textContent?.startsWith("Pesos debitados"))!;
    await act(async () => type(pesos, "510.000"));
    expect(container.textContent).toContain("Tasa del banco: 3.327,6785. Se guarda en lugar de la TRM.");
    await act(async () => button("Guardar pago").click());
    expect(actions.registerPayment).toHaveBeenCalledWith("s", "USD", expect.objectContaining({ copDebited: "510.000" }));
  });

  it("en pesos no ofrece pagar con pesos", async () => {
    await act(async () => root.render(<StatementPaymentForm statementId="s" currency="COP" today="2026-12-01" context="Visa · corte 15 nov" />));
    await act(async () => button("Registrar pago").click());
    expect(container.textContent).not.toContain("Pagué con pesos");
  });
});
