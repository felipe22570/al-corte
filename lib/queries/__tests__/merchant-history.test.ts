import { describe, expect, it, vi } from "vitest";
import { loadMerchantHistory } from "../merchant-history";

type Call = [string, ...unknown[]];

function fakeClient(result: { data: unknown[] | null; error: unknown }) {
  const calls: Call[] = [];
  const query: Record<string, (...args: unknown[]) => unknown> = {};
  for (const method of ["select", "eq", "in", "not", "is", "gte", "lte", "order"]) query[method] = (...args: unknown[]) => { calls.push([method, ...args]); return query; };
  query.limit = async (...args: unknown[]) => { calls.push(["limit", ...args]); return result; };
  const from = vi.fn(() => query);
  return { client: { from } as never, calls, from };
}

const raw = (overrides: Record<string, unknown>) => ({
  id: "t1", merchant: "Netflix", card_id: "visa", date: "2026-11-07", created_at: "2026-11-07T10:00:00Z", type: "purchase", category_id: "subs",
  installments_count: 1, original_installments_count: null, currency: "COP", is_international: false, interest_free: false, cards: { archived_at: null }, ...overrides,
});

describe("loadMerchantHistory (R11, D53)", () => {
  it("reads twelve months of purchases and advances on active cards and keeps the latest per merchant and card", async () => {
    const { client, calls, from } = fakeClient({ data: [
      raw({ id: "new", merchant: "NETFLIX", date: "2026-11-07", installments_count: 30, original_installments_count: 36 }),
      raw({ id: "old", date: "2026-10-07" }),
    ], error: null });
    const history = await loadMerchantHistory(client, "owner", "2026-11-21");
    expect(from).toHaveBeenCalledWith("transactions");
    expect(calls).toContainEqual(["eq", "user_id", "owner"]);
    expect(calls).toContainEqual(["in", "type", ["purchase", "cash_advance"]]);
    expect(calls).toContainEqual(["is", "cards.archived_at", null]);
    expect(calls).toContainEqual(["gte", "date", "2025-11-21"]);
    expect(calls).toContainEqual(["lte", "date", "2026-11-21"]);
    expect(history).toEqual([{ id: "new", merchant: "NETFLIX", cardId: "visa", date: "2026-11-07", createdAt: "2026-11-07T10:00:00Z", type: "purchase", categoryId: "subs", installmentsCount: 36, currency: "COP", isInternational: false, interestFree: false }]);
  });

  it("uses the stored installments when there is no original count and tolerates empty results", async () => {
    expect((await loadMerchantHistory(fakeClient({ data: [raw({ installments_count: 6 })], error: null }).client, "owner", "2026-11-21"))[0]?.installmentsCount).toBe(6);
    expect(await loadMerchantHistory(fakeClient({ data: null, error: null }).client, "owner", "2026-11-21")).toEqual([]);
  });

  it("fails with a readable message", async () => {
    await expect(loadMerchantHistory(fakeClient({ data: null, error: { message: "boom" } }).client, "owner", "2026-11-21")).rejects.toThrow("No pudimos consultar tus comercios recientes.");
  });
});
