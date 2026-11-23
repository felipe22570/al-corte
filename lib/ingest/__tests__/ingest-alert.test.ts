import { describe, expect, it } from "vitest";

import { readIngestConfig } from "../config";
import { ingestAlert, MAX_BODY_BYTES, REQUESTS_PER_MINUTE, type IngestDraft, type IngestStore } from "../ingest-alert";
import { signAlert, verifyAlertSignature } from "../signature";
import { ALERTS } from "./fixtures";

const secret = "s".repeat(40);
const owner = "99999999-9999-4999-8999-999999999999";
const visa = { id: "11111111-1111-4111-8111-111111111111", cutoffDay: 15 };
const now = new Date("2026-11-17T17:30:00Z");
const timestamp = String(Math.floor(now.getTime() / 1000));

function memoryStore(options: { enabled?: boolean; limitLeft?: number; cards?: Record<string, Array<{ id: string; cutoffDay: number }>>; fail?: boolean } = {}) {
  const drafts: IngestDraft[] = [];
  const calls: string[] = [];
  let left = options.limitLeft ?? 100;
  const store: IngestStore = {
    captureEnabled: async (userId) => (calls.push(`enabled:${userId}`), options.enabled ?? true),
    withinRateLimit: async (userId, limit) => {
      calls.push(`limit:${userId}:${limit}`);
      if (options.fail) throw new Error("db");
      return left-- > 0;
    },
    cardsFor: async (userId, last4) => (calls.push(`cards:${userId}:${last4}`), options.cards?.[last4] ?? []),
    insertDraft: async (draft) => {
      if (drafts.some((row) => row.user_id === draft.user_id && row.external_id === draft.external_id)) return null;
      drafts.push(draft);
      return `draft-${drafts.length}`;
    },
  };
  return { store, drafts, calls };
}

function signed(payload: unknown, at = timestamp) {
  const body = JSON.stringify(payload);
  return { body, timestamp: at, signature: signAlert(secret, at, body) };
}
const send = (request: { body: string; timestamp: string | null; signature: string | null }, store: IngestStore) => ingestAlert(request, { secret, userId: owner, store, now });

describe("ingestAlert (F18, R10)", () => {
  it("creates a pending draft with the alert facts, the owner and the tentative statement", async () => {
    const { store, drafts, calls } = memoryStore({ cards: { "1999": [visa] } });
    expect(await send(signed({ message_id: "msg-1", phrase: ALERTS.directv }), store)).toEqual({ status: 200, body: { ok: true, result: "created" }, draftId: "draft-1" });
    expect(drafts).toEqual([{
      user_id: owner, source: "email_alert", external_id: "msg-1", phrase: ALERTS.directv, status: "pending", card_id: visa.id, last4: "1999", type: "purchase",
      amount: "140910.00", currency: "COP", merchant_raw: "DIRECTV", occurred_on: "2026-11-17", occurred_time: "12:27", statement_cutoff: "2026-12-15",
    }]);
    expect(calls).toEqual([`enabled:${owner}`, `limit:${owner}:${REQUESTS_PER_MINUTE}`, `cards:${owner}:1999`]);
  });

  it("does not create a second draft for the same message", async () => {
    const { store, drafts } = memoryStore({ cards: { "1999": [visa] } });
    await send(signed({ message_id: "msg-1", phrase: ALERTS.chatgpt }), store);
    expect(await send(signed({ message_id: "msg-1", phrase: ALERTS.chatgpt }), store)).toEqual({ status: 200, body: { ok: true, result: "duplicate" } });
    expect(drafts).toHaveLength(1);
  });

  it("ignores an alert without a credit card and leaves no trace", async () => {
    const { store, drafts, calls } = memoryStore({ cards: { "1999": [visa] } });
    for (const phrase of [ALERTS.savings, ALERTS.debit]) {
      expect(await send(signed({ message_id: "msg-s", phrase }), store)).toEqual({ status: 200, body: { ok: true, result: "ignored" } });
    }
    expect(drafts).toEqual([]);
    expect(calls.some((call) => call.startsWith("cards:"))).toBe(false);
  });

  it("keeps a payment from savings for review, never as a purchase", async () => {
    const { store, drafts } = memoryStore({ cards: { "1999": [visa] } });
    await send(signed({ message_id: "msg-p", phrase: ALERTS.payment }), store);
    expect(drafts[0]).toMatchObject({ status: "needs_review", card_id: visa.id, last4: "1999", type: null, amount: null, currency: null, occurred_on: null, statement_cutoff: null });
  });

  it.each([
    ["unknown", {}],
    ["shared by two active cards", { "1999": [visa, { id: "22222222-2222-4222-8222-222222222222", cutoffDay: 30 }] }],
  ])("marks a card %s as unknown_card without guessing (D44)", async (_, cards) => {
    const { store, drafts } = memoryStore({ cards });
    await send(signed({ message_id: "msg-u", phrase: ALERTS.directv }), store);
    expect(drafts[0]).toMatchObject({ status: "unknown_card", card_id: null, last4: "1999", amount: "140910.00", statement_cutoff: null });
  });

  it.each([
    ["without signature", (request: ReturnType<typeof signed>) => ({ ...request, signature: null })],
    ["without timestamp", (request: ReturnType<typeof signed>) => ({ ...request, timestamp: null })],
    ["with another secret", (request: ReturnType<typeof signed>) => ({ ...request, signature: signAlert("x".repeat(40), request.timestamp, request.body) })],
    ["with a changed body", (request: ReturnType<typeof signed>) => ({ ...request, body: request.body.replace("140.910", "1.910") })],
    ["with a changed timestamp", (request: ReturnType<typeof signed>) => ({ ...request, timestamp: String(Number(request.timestamp) + 1) })],
  ])("rejects a request %s before touching the database", async (_, change) => {
    const { store, drafts, calls } = memoryStore({ cards: { "1999": [visa] } });
    expect(await send(change(signed({ message_id: "msg-1", phrase: ALERTS.directv })), store)).toEqual({ status: 401, body: { ok: false } });
    expect(drafts).toEqual([]);
    expect(calls).toEqual([]);
  });

  it("rejects a signature older or newer than 5 minutes", async () => {
    const { store } = memoryStore();
    const old = String(Number(timestamp) - 301);
    expect((await send(signed({ message_id: "m", phrase: ALERTS.directv }, old), store)).status).toBe(401);
    expect((await send(signed({ message_id: "m", phrase: ALERTS.directv }, String(Number(timestamp) + 301)), store)).status).toBe(401);
    expect(verifyAlertSignature(secret, String(Number(timestamp) - 300), signAlert(secret, String(Number(timestamp) - 300), "{}"), "{}", now)).toBe(true);
    expect(verifyAlertSignature(secret, "1e9", signAlert(secret, "1e9", "{}"), "{}", now)).toBe(false);
  });

  it("rejects bodies over 4 KB, invalid JSON and unexpected fields", async () => {
    const { store, drafts } = memoryStore({ cards: { "1999": [visa] } });
    const big = signed({ message_id: "m", phrase: "x".repeat(MAX_BODY_BYTES) });
    expect((await send(big, store)).status).toBe(413);
    const notJson = { body: "no", timestamp, signature: signAlert(secret, timestamp, "no") };
    expect((await send(notJson, store)).status).toBe(400);
    expect((await send(signed({ message_id: "m", phrase: ALERTS.directv, card_id: visa.id }), store)).status).toBe(400);
    expect((await send(signed({ message_id: "", phrase: ALERTS.directv }), store)).status).toBe(400);
    expect((await send(signed({ message_id: "m", phrase: "x".repeat(1001) }), store)).status).toBe(400);
    expect(drafts).toEqual([]);
  });

  it("rejects without drafts when capture is off or the limit is reached", async () => {
    const off = memoryStore({ enabled: false, cards: { "1999": [visa] } });
    expect(await send(signed({ message_id: "m", phrase: ALERTS.directv }), off.store)).toEqual({ status: 403, body: { ok: false } });
    expect(off.drafts).toEqual([]);
    const limited = memoryStore({ limitLeft: 0, cards: { "1999": [visa] } });
    expect(await send(signed({ message_id: "m", phrase: ALERTS.directv }), limited.store)).toEqual({ status: 429, body: { ok: false } });
    expect(limited.drafts).toEqual([]);
  });

  it("answers 500 without details when the database fails", async () => {
    const { store } = memoryStore({ fail: true });
    expect(await send(signed({ message_id: "m", phrase: ALERTS.directv }), store)).toEqual({ status: 500, body: { ok: false } });
  });
});

describe("readIngestConfig (D51)", () => {
  const env = { INGEST_SIGNING_SECRET: secret, INGEST_USER_ID: owner, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SECRET_KEY: "sb_secret_local" };
  it("needs every variable and a long secret", () => {
    expect(readIngestConfig(env)).toEqual({ secret, userId: owner, supabaseUrl: "http://127.0.0.1:54321", serviceKey: "sb_secret_local" });
    expect(readIngestConfig({ ...env, INGEST_SIGNING_SECRET: "corto" })).toBeNull();
    expect(readIngestConfig({ ...env, INGEST_USER_ID: "owner" })).toBeNull();
    expect(readIngestConfig({ ...env, SUPABASE_SECRET_KEY: undefined })).toBeNull();
  });
});
