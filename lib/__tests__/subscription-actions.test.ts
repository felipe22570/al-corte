import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/domain/dates", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/domain/dates")>()), todayInBogota: () => "2026-11-10" }));
import { createSubscription } from "@/lib/actions/subscriptions";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { name: "Servicio", cardId: id, categoryId: "", amount: "100.000", currency: "COP", frequency: "monthly", billingDay: "10", startDate: "2026-11-01", trialEndsAt: "" };
beforeEach(() => vi.clearAllMocks());
function setup(generated: number, error: object | null = null) {
  const card = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
  card.select.mockReturnValue(card); card.eq.mockReturnValue(card); card.is.mockReturnValue(card);
  const subscriptions = { insert: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
  subscriptions.insert.mockReturnValue(subscriptions); subscriptions.select.mockReturnValue(subscriptions);
  const transactions = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) };
  transactions.select.mockReturnValue(transactions); transactions.eq.mockReturnValue(transactions);
  const rpc = vi.fn().mockResolvedValue({ data: generated, error });
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: vi.fn((table: string) => table === "cards" ? card : table === "transactions" ? transactions : subscriptions), rpc });
  return { card, subscriptions, rpc };
}
it("validates before writing", async () => {
  expect((await createSubscription({ ...input, billingDay: "32" })).ok).toBe(false);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it("creates the subscription and immediately generates today's charge", async () => {
  const { card, subscriptions, rpc } = setup(1);
  expect(await createSubscription(input)).toEqual({ ok: true, id, warning: null });
  expect(card.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(subscriptions.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "owner", amount: "100000" }));
  expect(rpc).toHaveBeenCalledWith("generate_charges_for_subscription", { p_id: id });
});
it("reports a saved subscription when today's charge could not be generated", async () => {
  setup(0);
  const result = await createSubscription(input);
  expect(result.ok && result.warning).toContain("no se generó el cobro de hoy");
});
