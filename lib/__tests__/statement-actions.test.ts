import Decimal from "decimal.js";
import { beforeEach, expect, it, vi } from "vitest";
import { buildInstallmentPlan } from "@/lib/domain/installments";
import type { CloseContext } from "@/lib/queries/statement-close";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn(), loadCloseContext: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/queries/statement-close", () => ({ loadCloseContext: mocks.loadCloseContext }));
vi.mock("@/lib/domain/dates", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-21" }));
import { closeStatement, markStatementPaid, reopenStatement, unmarkStatementPaid } from "@/lib/actions/statements";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const purchaseId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
beforeEach(() => vi.clearAllMocks());
function mockClient() {
  const query = { upsert: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { card_id: id, cutoff_date: "2026-11-15", due_date: "2026-12-02" }, error: null }) };
  query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: id, error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from, rpc });
  return { query, from, rpc };
}
it("validates currencies and dates before touching the database", async () => {
  expect((await markStatementPaid(id, "2026-02-30")).ok).toBe(false);
  expect(await markStatementPaid(id, "2099-01-01")).toEqual({ ok: false, error: "La fecha de pago no puede ser posterior a hoy." });
  expect(await markStatementPaid(id, "2026-11-10", "EUR")).toEqual({ ok: false, error: "La moneda no es válida." });
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it("stores the Bogotá business date per currency and can undo payment", async () => {
  const { query } = mockClient();
  expect((await markStatementPaid(id, "2026-11-10")).ok).toBe(true);
  expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ currency: "COP", paid_at: "2026-11-10T05:00:00.000Z" }), { onConflict: "statement_id,currency" });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/meses/2026-12");
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  expect((await markStatementPaid(id, "2026-11-10", "USD")).ok).toBe(true);
  expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", paid_at: "2026-11-10T05:00:00.000Z" }), { onConflict: "statement_id,currency" });
  expect((await unmarkStatementPaid(id, "USD")).ok).toBe(true);
  expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD", paid_at: null }), { onConflict: "statement_id,currency" });
});
it("requires authentication for statement writes", async () => {
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, from: vi.fn() });
  expect((await markStatementPaid(id, "2026-11-10")).ok).toBe(false);
  expect((await unmarkStatementPaid(id)).ok).toBe(false);
  expect((await closeStatement(id, "COP", {})).ok).toBe(false);
  expect((await reopenStatement(id, "COP")).ok).toBe(false);
});
it("does not report success for another user's statement or a failed write", async () => {
  const { query } = mockClient();
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect((await markStatementPaid(id, "2026-11-10")).ok).toBe(false);
  expect(query.upsert).not.toHaveBeenCalled();
  query.upsert.mockResolvedValueOnce({ error: { code: "23503" } });
  expect((await unmarkStatementPaid(id)).ok).toBe(false);
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
  expect((await unmarkStatementPaid("no")).ok).toBe(false);
});

// Nevera de $600.000 a 6 cuotas del 10 de octubre: 2 cuotas facturadas al corte del 15 de noviembre.
function closeContext(overrides: Partial<CloseContext> = {}): CloseContext {
  const plan = buildInstallmentPlan({ principal: new Decimal(600000), count: 6, annualRateEa: new Decimal(0), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-10-10", interestMode: "on_balance" });
  return {
    statement: { id, cardId: "card", cutoffDate: "2026-11-15", dueDate: "2026-12-02" }, card: { id: "card", cutoffDay: 15 }, currency: "COP",
    calculated: { minimum: new Decimal(120000), debt: new Decimal(520000), interest: new Decimal(20000), estimated: true },
    bank: { minimum: null, debt: null, rateEa: null, reconciledAt: null, interest: null, lateInterest: null },
    purchases: [{ id: purchaseId, merchant: "Nevera", type: "purchase", date: "2026-10-10", installmentsCount: 6, calculated: new Decimal(400000), bankBalance: null, target: {
      id: purchaseId, type: "purchase", date: "2026-10-10", currency: "COP", installmentsCount: 6, interestFree: false, isInternational: false, statementCutoff: "2026-10-15",
      terms: { amount: new Decimal(600000), amountCop: new Decimal(600000), currency: "COP", fxRate: null, method: "fixed_principal", monthlyRate: new Decimal(0) }, rows: plan.rows, prepayments: [],
    } }],
    fxRate: null, ...overrides,
  };
}
it("closes a statement with bank values, interest, the rate in force and a balance correction (D39)", async () => {
  const { rpc } = mockClient();
  mocks.loadCloseContext.mockResolvedValue(closeContext());
  const result = await closeStatement(id, "COP", { realMinimum: "121.000", realTotal: "471.000", interest: "21.000", lateInterest: "", rate: "2,1003", rateUnit: "mv", reconcile: true,
    balances: [{ transactionId: purchaseId, bankBalance: "350.000" }] });
  expect(result).toEqual({ ok: true });
  const payload = rpc.mock.calls[0]![1].p_payload;
  expect(rpc.mock.calls[0]![0]).toBe("close_statement");
  expect(payload).toMatchObject({ real_minimum: "121000", real_total: "471000", interest: "21000", late_interest: null, rate_ea: "0.283288", fx_rate: null, reconcile: true, remove_corrections: [] });
  expect(payload.corrections).toEqual([expect.objectContaining({ transaction_id: purchaseId, bank_balance: "350000", amount: "50000", replaced_from_number: 3 })]);
  expect(payload.corrections[0].installments.map((row: { principal: string }) => row.principal)).toEqual(["100000", "100000", "100000", "50000"]);
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/meses/2026-12");
});
it("removes a correction when the bank balance is cleared or matches the calculation", async () => {
  const { rpc } = mockClient();
  const context = closeContext();
  mocks.loadCloseContext.mockResolvedValue({ ...context, purchases: [{ ...context.purchases[0]!, bankBalance: new Decimal(350000) }] });
  expect((await closeStatement(id, "COP", { balances: [{ transactionId: purchaseId, bankBalance: "" }] })).ok).toBe(true);
  expect(rpc.mock.calls[0]![1].p_payload).toMatchObject({ corrections: [], remove_corrections: [purchaseId], rate_ea: null, reconcile: false });
  expect((await closeStatement(id, "COP", { balances: [{ transactionId: purchaseId, bankBalance: "400.000,5" }] })).ok).toBe(true);
  expect(rpc.mock.calls[1]![1].p_payload).toMatchObject({ corrections: [], remove_corrections: [purchaseId] });
  mocks.loadCloseContext.mockResolvedValue(context);
  expect((await closeStatement(id, "COP", { balances: [{ transactionId: purchaseId, bankBalance: "" }], rate: "28,99", rateUnit: "ea" })).ok).toBe(true);
  expect(rpc.mock.calls[2]![1].p_payload).toMatchObject({ corrections: [], remove_corrections: [], rate_ea: "0.2899" });
});
it("reports invalid values, open statements, missing TRM and database errors", async () => {
  expect(await closeStatement("no", "COP", {})).toEqual({ ok: false, error: "El extracto no es válido." });
  expect(await closeStatement(id, "EUR", {})).toEqual({ ok: false, error: "La moneda no es válida." });
  expect(await closeStatement(id, "COP", { rate: "abc" })).toEqual({ ok: false, error: "Ingresa la tasa con hasta 4 decimales, por ejemplo 2,1003." });
  expect(await closeStatement(id, "COP", { realMinimum: "-1" })).toEqual({ ok: false, error: "Ingresa el pago mínimo como aparece en tu extracto." });
  const { rpc } = mockClient();
  mocks.loadCloseContext.mockResolvedValue(null);
  expect(await closeStatement(id, "COP", {})).toEqual({ ok: false, error: "El extracto ya no está disponible." });
  mocks.loadCloseContext.mockRejectedValue(new Error("boom"));
  expect(await closeStatement(id, "COP", {})).toEqual({ ok: false, error: "No pudimos consultar el extracto. Intenta de nuevo." });
  mocks.loadCloseContext.mockResolvedValue(closeContext({ statement: { id, cardId: "card", cutoffDate: "2026-12-15", dueDate: "2027-01-02" } }));
  expect(await closeStatement(id, "COP", {})).toEqual({ ok: false, error: "El extracto aún no ha cortado." });
  mocks.loadCloseContext.mockResolvedValue(closeContext({ currency: "USD" }));
  expect(await closeStatement(id, "USD", { interest: "2,5" })).toEqual({ ok: false, error: "Falta la TRM para registrar intereses en dólares." });
  mocks.loadCloseContext.mockResolvedValue(closeContext());
  expect(await closeStatement(id, "COP", { balances: [{ transactionId: purchaseId, bankBalance: "9.000.000" }] })).toEqual({ ok: false, error: "Con ese saldo el plan pasaría de 72 cuotas. Revisa el valor." });
  rpc.mockResolvedValueOnce({ error: { message: "Borra primero el pago más reciente de esa compra" } });
  expect(await closeStatement(id, "COP", { balances: [{ transactionId: purchaseId, bankBalance: "350.000" }] })).toEqual({ ok: false, error: "Esa compra recibió un abono después de este extracto. Borra ese pago antes de cambiar su saldo." });
  rpc.mockResolvedValueOnce({ error: { message: "El extracto tiene varios intereses registrados" } });
  expect(await closeStatement(id, "COP", { interest: "1" })).toEqual({ ok: false, error: "El extracto tiene varios cargos de intereses. Corrígelos desde movimientos." });
  rpc.mockResolvedValueOnce({ error: { message: "otro" } });
  expect(await closeStatement(id, "COP", {})).toEqual({ ok: false, error: "No pudimos guardar el cierre. Revisa los valores e intenta de nuevo." });
  mocks.loadCloseContext.mockResolvedValue(closeContext({ currency: "USD", fxRate: new Decimal("4000.5") }));
  expect((await closeStatement(id, "USD", { interest: "2,5" })).ok).toBe(true);
  expect(rpc.mock.calls.at(-1)![1].p_payload).toMatchObject({ currency: "USD", interest: "2.5", fx_rate: "4000.5" });
});
it("reopens only the reconciliation mark", async () => {
  const { rpc, query } = mockClient();
  expect(await reopenStatement(id, "USD")).toEqual({ ok: true });
  expect(rpc).toHaveBeenCalledWith("reopen_statement", { p_statement_id: id, p_currency: "USD" });
  rpc.mockResolvedValueOnce({ error: { message: "x" } });
  expect((await reopenStatement(id, "COP")).ok).toBe(false);
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect(await reopenStatement(id, "COP")).toEqual({ ok: false, error: "El extracto ya no está disponible." });
  expect(await reopenStatement("no", "COP")).toEqual({ ok: false, error: "El extracto no es válido." });
  expect(await reopenStatement(id, "EUR")).toEqual({ ok: false, error: "La moneda no es válida." });
});
