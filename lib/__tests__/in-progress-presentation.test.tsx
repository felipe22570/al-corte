import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AmortizationTable } from "@/components/amortization-table";
import { TransactionForm } from "@/components/transaction-form";
import { decodeTransactionDraft, encodeTransactionDraft } from "@/lib/transaction-draft";
import type { TransactionCardOption } from "@/lib/transaction-options";
import type { TransactionInput } from "@/lib/validation/transaction";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/actions/transactions", () => ({ createTransaction: vi.fn(), updateTransaction: vi.fn() }));

const cardId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const card: TransactionCardOption = { id: cardId, name: "Mastercard", last4: "5678", color: "card-2", cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.28", advanceRateEa: "0", advanceFee: "15000", amortizationMethod: "fixed_principal" };
// Avance de la Mastercard del 16 de abril: cuota 7 de 24 y saldo $269.998,46 en el extracto del 15 de noviembre.
const advance: TransactionInput = { cardId, type: "cash_advance", date: "2026-04-16", amount: "600.000", currency: "COP", fxRate: "", installmentsCount: "24", interestFree: false, categoryId: "", merchant: "Avance", note: "", inProgress: true, currentInstallment: "7", balanceAfter: "269.998,46", trackedFromCutoff: "2026-11-15" };
const renderForm = (initial: TransactionInput, existingCutoffs: Record<string, string[]> = {}, cards = [card]) => renderToStaticMarkup(<TransactionForm
  userId="owner" cards={cards} categories={[]} today="2026-11-17" latestRate={null} existingCutoffs={existingCutoffs}
  edit={{ id: "movement", initial, original: { cardId, type: initial.type as "cash_advance", rateEaApplied: "0" }, hasPaidInstallments: false }}
/>);

describe("compras en curso en el formulario (F10)", () => {
  it("muestra la cuota, el saldo y el extracto de la cuota k con la ayuda de D49", () => {
    const html = renderForm(advance);
    expect(html).toContain("Ya pagué cuotas de este avance");
    expect(html).toContain("Copia la cuota y el saldo como aparecen en tu último extracto.");
    expect(html).toContain("Saldo pendiente (opcional)");
    expect(html).toContain(">de 24<");
    expect(html).toContain("Corte del 15 nov · último cerrado");
  });

  it("previsualiza la cuota del extracto, las restantes y el cambio de plan", () => {
    const html = renderForm(advance, { [cardId]: ["2026-11-15"] });
    expect(html).toContain("Cuota 7 de 18");
    expect(html).toContain("Te faltan 11 cuotas después de esta.");
    expect(html).toContain("Según tu saldo, el plan queda en 18 cuotas en lugar de 24.");
    expect(html).toContain("sin comisión nueva");
    expect(html).not.toContain("Solo tendrá esta cuota.");
  });

  it("usa singular cuando queda una cuota", () => {
    const html = renderForm({ ...advance, type: "purchase", amount: "451.860", installmentsCount: "4", currentInstallment: "3", balanceAfter: "112.965" });
    expect(html).toContain("Ya pagué cuotas de esta compra");
    expect(html).toContain("Te falta 1 cuota después de esta.");
  });

  it("avisa cuando el extracto de la cuota k aún no tiene movimientos", () => {
    expect(renderForm(advance)).toContain("Solo tendrá esta cuota.");
  });

  it("con cuota fija solo pide la cuota", () => {
    const html = renderForm({ ...advance, balanceAfter: "" }, {}, [{ ...card, amortizationMethod: "french" }]);
    expect(html).toContain("Copia la cuota como aparece en tu último extracto.");
    expect(html).not.toContain("Saldo pendiente (opcional)");
  });

  it("en tarjetas con intereses sobre saldo explica que el interés llega en cada extracto (D32)", () => {
    const html = renderForm({ ...advance, type: "purchase", inProgress: false }, {}, [{ ...card, interestMode: "on_balance" }]);
    expect(html).toContain("Tu banco cobra los intereses sobre el saldo, en una línea de cada extracto.");
    expect(html).not.toContain("Intereses totales");
  });

  it("no ofrece cuotas pagadas a compras de una cuota", () => {
    expect(renderForm({ ...advance, installmentsCount: "1", inProgress: false })).not.toContain("Ya pagué cuotas");
  });

  it("conserva los campos de la compra en curso en el borrador", () => {
    expect(decodeTransactionDraft(encodeTransactionDraft(advance, "new", 1000), "new", 2000)).toEqual(advance);
  });
});

describe("tabla de amortización con cuotas previas", () => {
  it("atenúa las cuotas previas y las cuenta como pagadas", () => {
    const row = (number: number, cutoffDate: string | null, balanceAfter: string) => ({ number, cutoffDate, beforeTracking: cutoffDate === null, principal: "112965", interest: "0", total: "112965", balanceAfter, principalCop: "112965", interestCop: "0", totalCop: "112965" });
    const html = renderToStaticMarkup(<AmortizationTable currency="COP" today="2026-11-17" items={[row(1, null, "338895"), row(2, null, "225930"), row(3, "2026-11-15", "112965"), row(4, "2026-12-15", "0")]} />);
    expect(html.match(/Pagada antes de Al Corte/g)).toHaveLength(4);
    expect(html).toContain("Te faltan 1 de 4 cuotas");
    expect(html).toContain("Cuota 4 de 4");
    expect(html).toMatch(/<tr class="[^"]*text-muted-foreground"/);
    expect(html).toContain("text-amount text-muted-foreground");
  });
});
