import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { markStatementPaid, setStatementRealTotal, unmarkStatementPaid } from "@/lib/actions/statements";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
beforeEach(() => vi.clearAllMocks());
function mockClient() {
  const query = { update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { card_id: id, cutoff_date: "2026-11-15" }, error: null }) };
  query.update.mockReturnValue(query); query.eq.mockReturnValue(query); query.select.mockReturnValue(query);
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: vi.fn().mockReturnValue(query) });
  return query;
}
it("validates amounts and dates before touching the database", async () => {
  expect((await setStatementRealTotal(id, "-1")).ok).toBe(false);
  expect((await markStatementPaid(id, "2026-02-30")).ok).toBe(false);
  expect(mocks.createClient).not.toHaveBeenCalled();
});
it("stores the real amount for the authenticated owner", async () => {
  const query = mockClient();
  expect((await setStatementRealTotal(id, "120.000")).ok).toBe(true);
  expect(query.update).toHaveBeenCalledWith({ real_total: "120000" });
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
});
it("stores the Bogotá business date and can undo payment", async () => {
  const query = mockClient();
  expect((await markStatementPaid(id, "2026-11-10")).ok).toBe(true);
  expect(query.update).toHaveBeenCalledWith({ paid_at: "2026-11-10T05:00:00.000Z" });
  expect((await unmarkStatementPaid(id)).ok).toBe(true);
  expect(query.update).toHaveBeenCalledWith({ paid_at: null });
});
it("requires authentication for statement writes", async () => {
  mocks.createClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) }, from: vi.fn() });
  expect((await markStatementPaid(id, "2026-11-10")).ok).toBe(false);
  expect((await unmarkStatementPaid(id)).ok).toBe(false);
});
it("does not report success for another user's statement", async () => {
  const query = mockClient();
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  expect((await setStatementRealTotal(id, "100")).ok).toBe(false);
  expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(mocks.revalidatePath).not.toHaveBeenCalled();
});
