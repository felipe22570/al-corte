import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { markStatementPaid, recordStatementInterest, setStatementBankValues, unmarkStatementPaid } from "@/lib/actions/statements";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.clearAllMocks());
function mockClient() {
  const query = { upsert: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { card_id: id, cutoff_date: "2026-11-15", due_date: "2026-12-02" }, error: null }) };
  query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from });
  return { query, from };
}
it("validates amounts, currencies and dates before touching the database", async () => {
  expect((await setStatementBankValues(id, "COP", { realMinimum: "-1", realTotal: "" })).ok).toBe(false);
  expect((await markStatementPaid(id, "2026-02-30")).ok).toBe(false);
  expect(await markStatementPaid(id, "2099-01-01")).toEqual({ ok: false, error: "La fecha de pago no puede ser posterior a hoy." });
  expect(await markStatementPaid(id, "2026-11-10", "EUR")).toEqual({ ok: false, error: "La moneda no es válida." });
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it("stores the bank values per currency for the authenticated owner (D33)", async () => {
  const { query, from } = mockClient();
  expect((await setStatementBankValues(id, "USD", { realMinimum: "9", realTotal: "154" })).ok).toBe(true);
  expect(from).toHaveBeenCalledWith("statement_balances");
  expect(query.upsert).toHaveBeenCalledWith({ user_id: "owner", statement_id: id, currency: "USD", real_minimum: "9", real_total: "154" }, { onConflict: "statement_id,currency" });
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect((await setStatementBankValues(id, "COP", { realMinimum: "", realTotal: "3.845.775" })).ok).toBe(true);
  expect(query.upsert).toHaveBeenCalledWith(expect.objectContaining({ currency: "COP", real_minimum: null, real_total: "3845775" }), { onConflict: "statement_id,currency" });
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
});
it("does not report success for another user's statement or a failed write", async () => {
  const { query } = mockClient();
  query.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect((await setStatementBankValues(id, "COP", { realMinimum: "100", realTotal: "" })).ok).toBe(false);
  expect(query.upsert).not.toHaveBeenCalled();
  query.upsert.mockResolvedValueOnce({ error: { code: "23503" } });
  expect((await unmarkStatementPaid(id)).ok).toBe(false);
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
  expect((await unmarkStatementPaid("no")).ok).toBe(false);
});

function interestClient(card: Record<string, unknown>) {
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query);
  query.maybeSingle.mockResolvedValueOnce({ data: { card_id: id, cutoff_date: "2026-11-15", due_date: "2026-12-02" }, error: null })
    .mockResolvedValueOnce({ data: { id, cutoff_day: 15, payment_day: 2, purchase_rate_ea: "0.28", advance_rate_ea: "0.3", advance_fee: "0", amortization_method: "fixed_principal", interest_mode: "on_balance", ...card }, error: null });
  const rpc = vi.fn().mockResolvedValue({ data: "interest-id", error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: vi.fn().mockReturnValue(query), rpc });
  return rpc;
}
it("records the real interest of an on-balance statement on its cutoff date", async () => {
  const rpc = interestClient({});
  expect(await recordStatementInterest(id, { amount: "29.457,05", currency: "COP", fxRate: "" })).toEqual({ ok: true });
  expect(rpc).toHaveBeenCalledWith("create_transaction_with_installments", { p_payload: expect.objectContaining({ type: "interest", date: "2026-11-15", amount: "29457.05", amount_cop: "29457.05", installments_count: 1, rate_ea_applied: null }) });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/meses/2026-12");
});
it("converts USD interest with the TRM and validates it", async () => {
  const rpc = interestClient({});
  expect((await recordStatementInterest(id, { amount: "1,5", currency: "USD", fxRate: "4.000" })).ok).toBe(true);
  expect(rpc).toHaveBeenCalledWith("create_transaction_with_installments", { p_payload: expect.objectContaining({ currency: "USD", fx_rate: "4000", amount_cop: "6000" }) });
  expect(await recordStatementInterest(id, { amount: "1,5", currency: "USD", fxRate: "" })).toEqual({ ok: false, error: "Ingresa la TRM para intereses en dólares." });
  expect((await recordStatementInterest(id, { amount: "0", currency: "COP" })).ok).toBe(false);
  expect((await recordStatementInterest("no", { amount: "1", currency: "COP" })).ok).toBe(false);
});
it("only records interest on on-balance cards with an unchanged cutoff day", async () => {
  let rpc = interestClient({ interest_mode: "per_installment" });
  expect(await recordStatementInterest(id, { amount: "100", currency: "COP" })).toEqual({ ok: false, error: "Esta tarjeta cobra los intereses dentro de cada cuota." });
  rpc = interestClient({ cutoff_day: 20 });
  expect((await recordStatementInterest(id, { amount: "100", currency: "COP" })).ok).toBe(false);
  expect(rpc).not.toHaveBeenCalled();
});
