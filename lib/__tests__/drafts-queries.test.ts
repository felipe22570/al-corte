import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { countOpenDrafts, loadDraftProposal, loadOpenDraft, loadOpenDrafts } from "../queries/drafts";

type Result = { data?: unknown; error?: unknown; count?: number };

/** Minimal PostgREST builder: records each call and resolves to the next result queued for its table. */
function fakeClient(results: Record<string, Result[]>) {
  const calls: Array<{ table: string; steps: Array<[string, unknown[]]> }> = [];
  const from = vi.fn((table: string) => {
    const call = { table, steps: [] as Array<[string, unknown[]]> };
    calls.push(call);
    const result = () => {
      const next = results[table]?.shift() ?? { data: [] };
      return { data: next.data ?? null, error: next.error ?? null, count: next.count ?? null };
    };
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "neq", "order", "limit"]) builder[method] = (...args: unknown[]) => (call.steps.push([method, args]), builder);
    builder.maybeSingle = async () => {
      const next = result();
      return { ...next, data: Array.isArray(next.data) ? next.data[0] ?? null : next.data };
    };
    builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result()).then(resolve, reject);
    return builder;
  });
  return { client: { from } as never, calls };
}

const visa = "11111111-1111-4111-8111-111111111111";
const subscription = "77777777-7777-4777-8777-777777777777";
const draft = (change: Record<string, unknown> = {}) => ({
  id: "d1", status: "pending", phrase: "Compraste COP140.910,00 en DIRECTV", card_id: visa, last4: "1999", type: "purchase", amount: "140910.00",
  currency: "COP", merchant_raw: "DIRECTV", occurred_on: "2026-11-17", occurred_time: "12:27:00", statement_cutoff: "2026-12-15",
  suggestions: { confidence: "alta", subscriptionId: subscription }, created_at: "2026-11-17T17:30:00Z", ...change,
});

describe("draft queries", () => {
  it("loads what the capture proposed for an open draft of the owner (step 45)", async () => {
    const { client, calls } = fakeClient({ transaction_drafts: [{ data: [draft({ suggestions: { confidence: "alta", categoryId: subscription } })] }, { data: [] }, { error: { message: "x" } }] });
    expect(await loadDraftProposal(client, "owner", "d1")).toEqual({
      cardId: visa, type: "purchase", amount: "140910.00", currency: "COP", merchantRaw: "DIRECTV", occurredOn: "2026-11-17",
      suggestions: { merchantName: null, categoryId: subscription, subscriptionId: null, billingCurrency: null, installmentsCount: null, isInternational: null, confidence: "alta", reason: null },
    });
    expect(calls[0]!.steps).toEqual(expect.arrayContaining([["eq", ["user_id", "owner"]], ["eq", ["id", "d1"]], ["in", ["status", ["pending", "needs_review", "unknown_card"]]]]));
    expect(await loadDraftProposal(client, "owner", "d1")).toBeNull();
    expect(await loadDraftProposal(client, "owner", "d1")).toBeNull();
  });

  it("counts only open drafts", async () => {
    const { client, calls } = fakeClient({ transaction_drafts: [{ count: 3 }] });
    expect(await countOpenDrafts(client, "owner")).toBe(3);
    expect(calls[0]!.steps).toContainEqual(["in", ["status", ["pending", "needs_review", "unknown_card"]]]);
  });

  it("adds candidates not linked to other drafts and the subscription change", async () => {
    const { client } = fakeClient({
      transaction_drafts: [{ data: [draft()] }, { data: [{ transaction_id: "t2" }] }],
      transactions: [{ data: [
        { id: "t1", card_id: visa, amount: "140910.00", currency: "COP", date: "2026-11-17", merchant: "DirecTV", type: "purchase" },
        { id: "t2", card_id: visa, amount: "140910.00", currency: "COP", date: "2026-11-17", merchant: "Otro", type: "purchase" },
        { id: "t3", card_id: visa, amount: "1.00", currency: "COP", date: "2026-11-17", merchant: "Café", type: "purchase" },
      ] }],
      subscriptions: [{ data: [{ id: subscription, name: "DirecTV", amount: "83350.00", currency: "COP" }] }],
    });
    const [loaded] = await loadOpenDrafts(client, "owner");
    expect(loaded!.candidates.map((candidate) => candidate.id)).toEqual(["t1"]);
    expect(loaded!.subscription).toEqual({ name: "DirecTV", change: { charged: "140910.00", expected: "83350.00", currency: "COP" } });
    expect(loaded!.occurredTime).toBe("12:27");
  });

  it("ignores invalid stored suggestions and skips lookups without facts", async () => {
    const { client, calls } = fakeClient({ transaction_drafts: [{ data: [draft({ status: "needs_review", card_id: null, amount: null, suggestions: { confidence: "segura" } })] }] });
    const [loaded] = await loadOpenDrafts(client, "owner");
    expect(loaded).toMatchObject({ suggestions: null, candidates: [], subscription: null, status: "needs_review" });
    expect(calls.map((call) => call.table)).toEqual(["transaction_drafts"]);
  });

  it("loads one open draft or nothing", async () => {
    const { client } = fakeClient({ transaction_drafts: [{ data: [draft({ suggestions: null })] }, { data: [] }], transactions: [{ data: [] }] });
    expect((await loadOpenDraft(client, "owner", "d1"))?.id).toBe("d1");
    expect(await loadOpenDraft(client, "owner", "d2")).toBeNull();
  });

  it("fails closed on database errors", async () => {
    await expect(countOpenDrafts(fakeClient({ transaction_drafts: [{ error: new Error("db") }] }).client, "owner")).rejects.toThrow("por confirmar");
    await expect(loadOpenDrafts(fakeClient({ transaction_drafts: [{ error: new Error("db") }] }).client, "owner")).rejects.toThrow("por confirmar");
    await expect(loadOpenDrafts(fakeClient({ transaction_drafts: [{ data: [draft()] }], transactions: [{ error: new Error("db") }] }).client, "owner")).rejects.toThrow("por confirmar");
    await expect(loadOpenDraft(fakeClient({ transaction_drafts: [{ error: new Error("db") }] }).client, "owner", "d1")).rejects.toThrow("por confirmar");
  });
});

describe("drafts stay out of every financial calculation (D46)", () => {
  const root = new URL("../../", import.meta.url).pathname;
  const files = (dir: string): string[] => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : files(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });

  it("only the drafts query and the ingest store touch transaction_drafts", () => {
    const readers = [...files("lib"), ...files("app"), ...files("components")]
      .filter((path) => path !== "lib/database.types.ts" && readFileSync(join(root, path), "utf8").includes("transaction_drafts")).sort();
    expect(readers).toEqual(["lib/ingest/supabase-store.ts", "lib/queries/drafts.ts"]);
  });
});
