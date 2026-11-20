import Decimal from "decimal.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildInstallmentPlan } from "@/lib/domain/installments";
import type { PaymentTarget } from "@/lib/domain/payments";
import type { PaymentContext } from "@/lib/queries/payments";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn(), loadPaymentContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/queries/payments", () => ({ loadPaymentContext: mocks.loadPaymentContext }));
vi.mock("@/lib/domain/dates", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-30" }));
import { previewPayment, registerPayment } from "@/lib/actions/payments";
import { paymentSchema } from "@/lib/validation/payment";

const statementId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const purchaseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const singleId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function target(id: string, amount: string, count: number, date: string): PaymentTarget {
  const plan = buildInstallmentPlan({ principal: new Decimal(amount), count, annualRateEa: new Decimal(0), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: date, interestMode: "on_balance" });
  return {
    id, type: "purchase", date, currency: "COP", installmentsCount: count, interestFree: false, isInternational: false, statementCutoff: count > 1 ? plan.rows[0]!.cutoffDate! : "2026-12-15",
    terms: { amount: new Decimal(amount), amountCop: plan.amountCop, currency: "COP", fxRate: null, method: "fixed_principal", monthlyRate: new Decimal(0) },
    rows: count > 1 ? plan.rows : [], prepayments: [],
  };
}

function context(overrides: Partial<PaymentContext> = {}): PaymentContext {
  return {
    statement: { id: statementId, cardId: "card", cutoffDate: "2026-11-15", dueDate: "2026-12-02", nextCutoff: "2026-12-15" },
    card: { id: "card", name: "Visa", last4: "1234", rule: "bancolombia_priority" }, currency: "COP",
    pending: new Decimal("150000"), minimum: new Decimal("150000"), paidAt: null,
    targets: [target(purchaseId, "600000", 6, "2026-10-10"), target(singleId, "50000", 1, "2026-11-20")],
    labels: new Map([[purchaseId, { merchant: "Nevera", type: "purchase", date: "2026-10-10", installmentsCount: 6 }], [singleId, { merchant: null, type: "purchase", date: "2026-11-20", installmentsCount: 1 }]]),
    fxRate: null, ...overrides,
  };
}

function mockClient(rpcError: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data: "payment", error: rpcError });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, rpc });
  return rpc;
}

beforeEach(() => vi.clearAllMocks());

describe("payment validation (D37)", () => {
  it("requires the amount for another value and ignores empty rows of the distribution", () => {
    expect(paymentSchema.safeParse({ kind: "other", date: "2026-11-30", amount: "" }).success).toBe(false);
    expect(paymentSchema.safeParse({ kind: "other", date: "2026-11-30", amount: "300.000", distribution: [{ transactionId: purchaseId, amount: "abc" }] }).success).toBe(false);
    const parsed = paymentSchema.parse({ kind: "other", date: "2026-11-30", amount: "300.000,5", distribution: [{ transactionId: purchaseId, amount: "100.000" }, { transactionId: singleId, amount: "" }, { transactionId: singleId, amount: "0" }] });
    expect(parsed.amount?.toString()).toBe("300000.5");
    expect(parsed.distribution).toEqual([{ transactionId: purchaseId, amount: new Decimal("100000") }]);
    expect(paymentSchema.parse({ kind: "minimum", date: "2026-11-30" })).toMatchObject({ amount: null, effect: "reduce_term", distribution: undefined });
  });
});

describe("payment actions (F14)", () => {
  it("rejects invalid input before touching the database", async () => {
    expect(await previewPayment("x", "COP", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "El extracto no es válido." });
    expect(await previewPayment(statementId, "EUR", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "La moneda no es válida." });
    expect(await previewPayment(statementId, "COP", { kind: "other", date: "2026-11-30", amount: "" })).toEqual({ ok: false, error: "Ingresa el valor que pagaste, mayor que cero." });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("previews the minimum, the total and the proposed distribution of another value", async () => {
    mockClient();
    mocks.loadPaymentContext.mockResolvedValue(context());
    const minimum = await previewPayment(statementId, "COP", { kind: "minimum", date: "2026-11-30" });
    expect(minimum).toMatchObject({ ok: true, preview: { amount: "150000", minimumAmount: "150000", totalAmount: "550000", prepayments: [] } });
    const other = await previewPayment(statementId, "COP", { kind: "other", date: "2026-11-30", amount: "300.000" });
    if (!other.ok) throw new Error(other.error);
    expect(other.preview.candidates.map((item) => [item.label, item.detail])).toEqual([["Compra", "Compra del 20 nov · 1 cuota"], ["Nevera", "Compra del 10 oct · 6 cuotas"]]);
    expect(other.preview.prepayments).toEqual([
      { transactionId: singleId, amount: "50000", assumed: false, remainingInstallments: null, nextInstallment: null },
      { transactionId: purchaseId, amount: "100000", assumed: false, remainingInstallments: 3, nextInstallment: "100000" },
    ]);
  });

  it("checks the payment date and the statement", async () => {
    mockClient();
    mocks.loadPaymentContext.mockResolvedValue(context());
    expect(await previewPayment(statementId, "COP", { kind: "minimum", date: "2026-11-15" })).toEqual({ ok: false, error: "Registra pagos de extractos ya cortados, con fecha posterior al corte." });
    mocks.loadPaymentContext.mockResolvedValue(context({ pending: new Decimal(0) }));
    expect(await previewPayment(statementId, "COP", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "El pago mínimo de este extracto ya está cubierto." });
    mocks.loadPaymentContext.mockResolvedValue(null);
    expect(await registerPayment(statementId, "COP", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "El extracto ya no está disponible." });
    mocks.loadPaymentContext.mockRejectedValue(new Error("boom"));
    expect(await registerPayment(statementId, "COP", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "No pudimos consultar el extracto. Intenta de nuevo." });
  });

  it("registers the edited distribution, marks the minimum as paid and refreshes the views", async () => {
    const rpc = mockClient();
    mocks.loadPaymentContext.mockResolvedValue(context());
    const result = await registerPayment(statementId, "COP", { kind: "other", date: "2026-11-30", amount: "300.000", distribution: [{ transactionId: purchaseId, amount: "150.000" }] });
    expect(result).toEqual({ ok: true, markedPaid: true });
    const payload = rpc.mock.calls[0]![1].p_payload;
    expect(rpc).toHaveBeenCalledWith("register_payment", expect.anything());
    expect(payload).toMatchObject({ statement_id: statementId, amount: "300000", kind: "other", mark_paid: true });
    expect(payload.prepayments).toEqual([expect.objectContaining({ transaction_id: purchaseId, amount: "150000", assumed: false, replaced_from_number: 3 })]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("reports distribution, TRM and database errors", async () => {
    const rpc = mockClient({ message: "Abono inconsistente" });
    mocks.loadPaymentContext.mockResolvedValue(context());
    expect(await registerPayment(statementId, "COP", { kind: "other", date: "2026-11-30", amount: "300.000", distribution: [{ transactionId: purchaseId, amount: "10.000" }] }))
      .toEqual({ ok: false, error: "La distribución no suma el valor del abono." });
    expect(await registerPayment(statementId, "COP", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "No pudimos registrar el pago. Revisa los datos e intenta de nuevo." });
    mocks.loadPaymentContext.mockResolvedValue(context({ currency: "USD", targets: [], pending: new Decimal("8.22") }));
    expect(await registerPayment(statementId, "USD", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "Falta la TRM para registrar un pago en dólares." });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("requires a session", async () => {
    mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } });
    expect(await registerPayment(statementId, "COP", { kind: "minimum", date: "2026-11-30" })).toEqual({ ok: false, error: "Inicia sesión para registrar el pago." });
  });
});
