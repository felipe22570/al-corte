import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { createTransaction, deleteTransaction } from "@/lib/actions/transactions";

const input = { cardId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "purchase", date: "2026-01-20", amount: "100.000", currency: "COP", fxRate: "", installmentsCount: "2", interestFree: false, categoryId: "", merchant: "Tienda", note: "" };
beforeEach(() => vi.clearAllMocks());

it("rechaza datos inválidos antes de consultar la tarjeta", async () => {
  expect((await createTransaction({ ...input, installmentsCount: "37" })).ok).toBe(false);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it("exige una sesión autenticada", async () => {
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } });
  expect((await createTransaction(input)).ok).toBe(false);
});
it("rechaza un identificador inválido antes de borrar", async () => {
  expect((await deleteTransaction("no-es-un-uuid")).ok).toBe(false);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it("no permite borrar la comisión de un avance por separado", async () => {
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { type: "advance_fee", parent_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, error: null }), delete: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: vi.fn().mockReturnValue(query) });
  expect((await deleteTransaction("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).ok).toBe(false);
  expect(query.delete).not.toHaveBeenCalled();
});
it("calcula el payload con los datos de la tarjeta del usuario", async () => {
  const maybeSingle = vi.fn().mockResolvedValue({ data: { id: input.cardId, cutoff_day: 15, payment_day: 5, purchase_rate_ea: "0.28", advance_rate_ea: "0.36", advance_fee: "15000", amortization_method: "fixed_principal" }, error: null });
  const query = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.is.mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: "transaction-id", error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: vi.fn().mockReturnValue(query), rpc });
  const result = await createTransaction(input);
  expect(result).toEqual({ ok: true, id: "transaction-id" });
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(rpc).toHaveBeenCalledWith("create_transaction_with_installments", { p_payload: expect.objectContaining({ card_id: input.cardId, amount: "100000", amount_cop: "100000", rate_ea_applied: "0.28", installments_count: 2, installments: expect.arrayContaining([expect.objectContaining({ number: 1, cutoff_date: "2026-02-15" })]) }) });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/movimientos");
});
