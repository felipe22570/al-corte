import Decimal from "decimal.js";
import { beforeEach, expect, it, vi } from "vitest";
import { buildInstallmentPlan } from "@/lib/domain/installments";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn(), loadPlanTarget: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/queries/plan-target", () => ({ loadPlanTarget: mocks.loadPlanTarget }));
vi.mock("@/lib/domain/dates", async (importOriginal) => ({ ...await importOriginal<typeof import("@/lib/domain/dates")>(), todayInBogota: () => "2026-11-21" }));
import { changeInstallmentsAction, previewInstallmentChange, undoInstallmentChange } from "@/lib/actions/installment-changes";
import { installmentChangeSchema } from "@/lib/validation/installment-change";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.clearAllMocks());

function context() {
  const plan = buildInstallmentPlan({ principal: new Decimal(600000), count: 6, annualRateEa: new Decimal(0), method: "fixed_principal", interestFree: false, currency: "COP", cutoffDay: 15, purchaseDate: "2026-11-10", interestMode: "on_balance" });
  return { cutoffDay: 15, interestRate: new Decimal("0.0214"), target: {
    id, type: "purchase", date: "2026-11-10", currency: "COP", installmentsCount: 6, interestFree: false, isInternational: false, statementCutoff: "2026-11-15",
    terms: { amount: new Decimal(600000), amountCop: new Decimal(600000), currency: "COP", fxRate: null, method: "fixed_principal", monthlyRate: new Decimal(0) }, rows: plan.rows, prepayments: [],
  } };
}
function client(rpcError: unknown = null, deleteResult: { data: unknown; error: unknown } = { data: { id }, error: null }) {
  const query = { delete: vi.fn(), eq: vi.fn(), not: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(deleteResult) };
  query.delete.mockReturnValue(query); query.eq.mockReturnValue(query); query.not.mockReturnValue(query); query.select.mockReturnValue(query);
  const rpc = vi.fn().mockResolvedValue({ data: "change", error: rpcError });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, rpc, from: vi.fn().mockReturnValue(query) });
  return { rpc, query };
}

it("validates the installments left (1 to 36)", () => {
  expect(installmentChangeSchema.parse({ remaining: "12" }).remaining).toBe(12);
  for (const remaining of ["0", "37", "1.5", "abc"]) expect(installmentChangeSchema.safeParse({ remaining }).success).toBe(false);
});

it("previews the new installment and the interest difference (F16)", async () => {
  client();
  mocks.loadPlanTarget.mockResolvedValue(context());
  const result = await previewInstallmentChange(id, { remaining: "12" });
  expect(result).toMatchObject({ ok: true, preview: { pending: "500000", nextInstallment: "41666.67", previousInstallment: "100000", effectivePlan: 13 } });
  expect(await previewInstallmentChange(id, { remaining: "40" })).toEqual({ ok: false, error: "Elige entre 1 y 36 cuotas restantes." });
  expect(await previewInstallmentChange("no", { remaining: "2" })).toEqual({ ok: false, error: "La compra no es válida." });
});

it("saves the change through the RPC and reports errors", async () => {
  const { rpc } = client();
  mocks.loadPlanTarget.mockResolvedValue(context());
  expect(await changeInstallmentsAction(id, { remaining: "12" })).toEqual({ ok: true });
  expect(rpc).toHaveBeenCalledWith("change_installments", { p_payload: expect.objectContaining({ transaction_id: id, remaining_installments: 12, replaced_from_number: 2 }) });
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  rpc.mockResolvedValueOnce({ error: { message: "x" } });
  expect(await changeInstallmentsAction(id, { remaining: "12" })).toEqual({ ok: false, error: "No pudimos cambiar las cuotas. Revisa los datos e intenta de nuevo." });
  mocks.loadPlanTarget.mockResolvedValue(null);
  expect(await changeInstallmentsAction(id, { remaining: "12" })).toEqual({ ok: false, error: "La compra ya no está disponible." });
  mocks.loadPlanTarget.mockRejectedValue(new Error("boom"));
  expect(await changeInstallmentsAction(id, { remaining: "12" })).toEqual({ ok: false, error: "No pudimos consultar la compra. Intenta de nuevo." });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } });
  expect(await changeInstallmentsAction(id, { remaining: "12" })).toEqual({ ok: false, error: "Inicia sesión para cambiar las cuotas." });
});

it("undoes only the latest installment change", async () => {
  const { query } = client();
  expect(await undoInstallmentChange(id)).toEqual({ ok: true });
  expect(query.not).toHaveBeenCalledWith("remaining_installments", "is", null);
  client(null, { data: null, error: { message: "Borra primero el pago más reciente de esa compra" } });
  expect(await undoInstallmentChange(id)).toEqual({ ok: false, error: "La compra tiene un abono o un saldo del banco posterior. Deshazlo primero." });
  client(null, { data: null, error: null });
  expect((await undoInstallmentChange(id)).ok).toBe(false);
  expect(await undoInstallmentChange("no")).toEqual({ ok: false, error: "El cambio no es válido." });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } });
  expect(await undoInstallmentChange(id)).toEqual({ ok: false, error: "Inicia sesión para deshacer el cambio." });
});
