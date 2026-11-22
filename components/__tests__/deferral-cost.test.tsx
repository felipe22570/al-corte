import Decimal from "decimal.js";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeferralCost } from "@/components/deferral-cost";
import { MonthStatementCard } from "@/components/month-statement-card";
import { PayInFullSavings } from "@/components/pay-in-full-savings";
import { TransactionForm } from "@/components/transaction-form";
import { deferralCostSummary, type DeferralPurchase } from "@/lib/domain/deferral-cost";
import { buildInstallmentPlan } from "@/lib/domain/installments";
import { buildMonths } from "@/lib/domain/months";
import type { TransactionCardOption } from "@/lib/transaction-options";
import type { TransactionInput } from "@/lib/validation/transaction";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions/transactions", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }));
vi.mock("@/lib/actions/statements", () => ({ markStatementPaid: vi.fn(), unmarkStatementPaid: vi.fn() }));

const cardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
// 28,3288 % E.A., 2,1003 % M.V. (F21).
const card: TransactionCardOption = { id: cardId, name: "Visa", last4: "1234", color: "card-1", cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.283288", advanceRateEa: "0.283288", advanceFee: "0", amortizationMethod: "fixed_principal", interestMode: "on_balance" };
const input: TransactionInput = { cardId, type: "purchase", date: "2026-11-20", amount: "9.000", currency: "COP", fxRate: "", installmentsCount: "36", interestFree: false, isInternational: false, advanceFee: "", categoryId: "", merchant: "Tienda", note: "", inProgress: false, currentInstallment: "", balanceAfter: "", trackedFromCutoff: "" };
const renderForm = (initial: TransactionInput, cards = [card]) => renderToStaticMarkup(<TransactionForm userId="owner" cards={cards} categories={[]} today="2026-11-21" latestRate={null}
  edit={{ id: "movement", initial, original: { cardId, type: "purchase", rateEaApplied: "0.283288" }, hasPaidInstallments: false }} />);

describe("costo de diferir en el formulario (F21)", () => {
  it("muestra intereses estimados, total y la alerta sobre el 20 % con intereses sobre saldo", () => {
    const html = renderForm(input);
    expect(html).toContain("Intereses estimados: <span");
    expect(html).toContain("$3.308");
    expect(html).toContain("$12.308");
    expect(html).toContain("Diferir esta compra cuesta un 37% más.");
    expect(html).toContain("Tu banco cobra los intereses sobre el saldo, en una línea de cada extracto.");
  });

  it("con intereses por cuota usa la suma de las cuotas", () => {
    const html = renderForm(input, [{ ...card, interestMode: "per_installment" }]);
    expect(html).toContain("$3.497");
    expect(html).toContain("$12.497");
    expect(html).not.toContain("Tu banco cobra los intereses sobre el saldo");
  });

  it("sin alerta por debajo del 20 % y sin intereses en compras a una cuota o sin intereses", () => {
    expect(renderForm({ ...input, installmentsCount: "6" })).not.toContain("Diferir esta compra cuesta");
    expect(renderForm({ ...input, installmentsCount: "1" })).toContain("Sin intereses");
    expect(renderForm({ ...input, interestFree: true })).toContain("Sin intereses");
  });

  it("en una compra en curso muestra solo los intereses restantes, sin total ni alerta", () => {
    const html = renderForm({ ...input, date: "2026-02-01", inProgress: true, currentInstallment: "10", trackedFromCutoff: "2026-11-15" });
    expect(html).toContain("Intereses restantes (estimado)");
    expect(html).toContain("$1.985");
    expect(html).not.toContain("Total <span");
    expect(html).not.toContain("Diferir esta compra cuesta");
  });
});

function summary(mode: "per_installment" | "on_balance", currency: "COP" | "USD" = "COP") {
  const amount = new Decimal(currency === "USD" ? "100" : "9000");
  const fxRate = currency === "USD" ? new Decimal("4000") : null;
  const plan = buildInstallmentPlan({ principal: amount, count: 36, annualRateEa: new Decimal("0.283288"), method: "fixed_principal", interestFree: false, currency, fxRate: fxRate ?? undefined, cutoffDay: 15, purchaseDate: "2026-08-20", interestMode: mode });
  const purchase: DeferralPurchase = { amount, currency, fxRate, purchaseDate: "2026-08-20", rateEa: new Decimal("0.283288"), interestFree: false, interestMode: mode, cutoffDay: 15, installmentsCount: 36, rows: plan.rows };
  return deferralCostSummary(purchase, "2026-11-21");
}

describe("costo de diferir en el detalle (F21)", () => {
  it("con intereses por cuota separa facturados de los estimados por pagar", () => {
    const html = renderToStaticMarkup(<DeferralCost summary={summary("per_installment")} currency="COP" onBalance={false} />);
    expect(html).toContain("Costo de diferir");
    expect(html).toContain("Intereses facturados");
    expect(html).toContain("Por pagar (estimado)");
    expect(html).toContain("Total de intereses (estimado)");
    expect(html).toContain("Equivale al 39% del valor.");
    expect(html).not.toContain("no los reparte por compra");
  });

  it("con intereses sobre saldo todo es estimado y lo explica", () => {
    const html = renderToStaticMarkup(<DeferralCost summary={summary("on_balance")} currency="COP" onBalance />);
    expect(html).toContain("Causados hasta el último corte (estimado)");
    expect(html).toContain("Por causar (estimado)");
    expect(html).toContain("no los reparte por compra");
  });

  it("en dólares muestra la referencia en pesos con la TRM de la compra", () => {
    const html = renderToStaticMarkup(<DeferralCost summary={summary("on_balance", "USD")} currency="USD" onBalance />);
    expect(html).toContain("US$ ");
    expect(html).toMatch(/cerca de \$[\d.]+ con la TRM de la compra/);
  });
});

describe("ahorro por pagar el total (F21)", () => {
  it("muestra el ahorro estimado solo cuando es mayor que cero", () => {
    expect(renderToStaticMarkup(<PayInFullSavings amount={new Decimal("185000.4")} currency="COP" />)).toContain("Si pagas la deuda total te ahorras cerca de <span");
    expect(renderToStaticMarkup(<PayInFullSavings amount={new Decimal("185000.4")} currency="COP" />)).toContain("$185.000</span> en intereses (estimado).");
    expect(renderToStaticMarkup(<PayInFullSavings amount={new Decimal(0)} currency="COP" />)).toBe("");
    expect(renderToStaticMarkup(<PayInFullSavings amount={undefined} currency="COP" />)).toBe("");
  });

  it("aparece por moneda en el extracto del mes", () => {
    const statement = {
      id: "s", cardId: "visa", origin: "real" as const, periodStart: "2026-10-16", cutoffDate: "2026-11-15", dueDate: "2026-12-02",
      paidAt: null, paidByCurrency: { COP: null, USD: null }, recordedTotal: new Decimal(100000), projectedTotal: new Decimal(0),
      recordedUsd: new Decimal(5), projectedUsd: new Decimal(0), debt: { COP: new Decimal(400000), USD: new Decimal(10) }, unconvertedCharges: [],
    };
    const month = buildMonths([statement], "2026-11-21").find((item) => item.month === "2026-12");
    const html = renderToStaticMarkup(<MonthStatementCard group={month!.cards[0]!} card={{ id: "visa", name: "Visa", last4: "1234", color: "card-1" }} today="2026-11-21" savings={new Map([["s", { COP: new Decimal(185000), USD: new Decimal("2.5") }]])} />);
    expect(html).toContain("Si pagas la deuda total en pesos te ahorras cerca de");
    expect(html).toContain("Si pagas la deuda total en dólares te ahorras cerca de");
    expect(html).toContain("US$ 2,50");
  });
});
