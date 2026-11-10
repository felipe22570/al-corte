import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createCard } from "@/lib/actions/cards";
import { createCategory } from "@/lib/actions/categories";

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
