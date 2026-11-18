import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { archiveCard, createCard, updateCard } from "@/lib/actions/cards";
import { archiveCategory, createCategory, updateCategory } from "@/lib/actions/categories";

const validCard = { name: "Visa", bank: "Banco", network: "Visa", last4: "1234", creditLimit: "1.000.000", advanceFee: "0", handlingFee: "0", cutoffDay: "31", paymentDay: "15", purchaseRateEa: "28,5", advanceRateEa: "30", amortizationMethod: "fixed_principal", color: "card-3" };

beforeEach(() => vi.clearAllMocks());

it("rechaza un color inválido antes de acceder a la base", async () => {
  const result = await createCard({ ...validCard, color: "#ff0000" });
  expect(result.ok).toBe(false);
  expect(mocks.createClient).not.toHaveBeenCalled();
});

it("exige una sesión para guardar una tarjeta", async () => {
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) } });
  const result = await createCard(validCard);
  expect(result.ok).toBe(false);
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});

it("guarda el dueño autenticado y montos normalizados como texto", async () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } } }) }, from: vi.fn().mockReturnValue({ insert }) });
  const result = await createCard({ ...validCard, user_id: "otro-usuario" });
  expect(result.ok).toBe(true);
  expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-a", credit_limit: "1000000", purchase_rate_ea: "0.285", cutoff_day: 31, color: "card-3" }));
  expect(mocks.revalidatePath).toHaveBeenCalledWith("/ajustes");
});

it("traduce el error de categoría duplicada", async () => {
  const insert = vi.fn().mockResolvedValue({ error: { code: "23505" } });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } } }) }, from: vi.fn().mockReturnValue({ insert }) });
  const result = await createCategory({ name: "Mercado", icon: "shopping-cart" });
  expect(result.ok).toBe(false);
  expect(result).toMatchObject({ error: "Ya tienes una categoría con ese nombre." });
});

it("invalidates all financial routes after card and category updates or archiving", async () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } } }) }, from: vi.fn().mockReturnValue(query) });
  for (const action of [
    () => updateCard(id, validCard), () => archiveCard(id),
    () => updateCategory(id, { name: "Mercado", icon: "shopping-cart" }), () => archiveCategory(id),
  ]) {
    mocks.revalidatePath.mockClear();
    expect((await action()).ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/meses/[mes]", "page");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  }
});

it("explica por qué no se puede cambiar el modo de intereses (D32)", async () => {
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { code: "23514", message: "No puedes cambiar el modo de intereses: la tarjeta ya tiene compras a cuotas." } }) };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-a" } } }) }, from: vi.fn().mockReturnValue(query) });
  expect(await updateCard(id, { ...validCard, interestMode: "on_balance" })).toEqual({ ok: false, error: "No puedes cambiar cómo se cobran los intereses: la tarjeta ya tiene compras a cuotas." });
  expect(query.update).toHaveBeenCalledWith(expect.objectContaining({ interest_mode: "on_balance" }));
});
