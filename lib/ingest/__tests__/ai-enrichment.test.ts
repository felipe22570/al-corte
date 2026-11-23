import Decimal from "decimal.js";
import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { describe, expect, it } from "vitest";

import type { AiClient, AiContext } from "@/lib/ai/types";
import { enrichDraft, sanitizeSuggestions, type EnrichableDraft, type EnrichStore, type HistoryRow } from "../ai-enrichment";
import { ALERTS } from "./fixtures";

const owner = "99999999-9999-4999-8999-999999999999";
const visa = "11111111-1111-4111-8111-111111111111";
const subs = "33333333-3333-4333-8333-333333333333";
const tech = "44444444-4444-4444-8444-444444444444";
const directvSub = "55555555-5555-4555-8555-555555555555";

const message = (json: unknown): Message => ({
  id: "m", type: "message", role: "assistant", model: "claude-opus-5-5", content: [{ type: "text", text: JSON.stringify(json), citations: null }],
  stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 500, output_tokens: 80, cache_creation_input_tokens: null, cache_read_input_tokens: null },
} as unknown as Message);

/** Answers by task: the fallback has `amountText` in its schema. */
function fakeAi(answers: { interpret?: unknown; extract?: unknown }, client = true) {
  const calls: Array<{ task: "interpret" | "extract"; body: MessageCreateParamsNonStreaming }> = [];
  const ai: AiClient = {
    messages: {
      create: async (body) => {
        const task = JSON.stringify(body.output_config?.format?.schema).includes("amountText") ? "extract" : "interpret";
        calls.push({ task, body });
        return message(answers[task]);
      },
    },
  };
  const usage: string[] = [];
  const context: AiContext = {
    userId: owner, client: client ? ai : null,
    usage: { spentSince: async () => new Decimal(0), record: async (row) => { usage.push(`${row.task}:${row.result}`); } },
    config: { monthlyBudgetUsd: new Decimal(5), modelFor: () => "claude-opus-5-5" },
  };
  return { context, calls, usage };
}

const pending: EnrichableDraft = { id: "d1", status: "pending", phrase: ALERTS.chatgpt, cardId: visa, last4: "1999", type: "purchase", amount: "81000.00", currency: "COP", merchantRaw: "GOOGLE *ChatGPT", suggestions: null };
const history: HistoryRow[] = [
  { merchant: "GOOGLE *YouTube", date: "2026-11-05", categoryId: subs, currency: "USD", installments: 36, amount: "13.99" },
  { merchant: "DIRECTV", date: "2026-10-17", categoryId: subs, currency: "COP", installments: 1, amount: "83350.00" },
];

function memoryStore(draft: EnrichableDraft | null, options: { cards?: Record<string, Array<{ id: string; cutoffDay: number }>>; fail?: boolean } = {}) {
  const saved: { facts?: unknown; suggestions?: unknown } = {};
  const store: EnrichStore = {
    loadDraft: async (userId, id) => {
      if (options.fail) throw new Error("db");
      return userId === owner && draft?.id === id ? draft : null;
    },
    categories: async () => [{ id: subs, name: "Suscripciones" }, { id: tech, name: "Tecnología" }],
    subscriptions: async () => [{ id: directvSub, name: "DirecTV", amount: "83350.00", currency: "COP", installments: 1 }],
    history: async () => history,
    cardsFor: async (_, last4) => options.cards?.[last4] ?? [],
    card: async (_, id) => (id === visa ? { id: visa, cutoffDay: 15 } : null),
    saveReadFacts: async (_, __, facts) => { saved.facts = facts; },
    saveSuggestions: async (_, __, suggestions) => { saved.suggestions = suggestions; },
  };
  return { store, saved };
}

const deps = (context: AiContext, store: EnrichStore) => ({ userId: owner, ai: context, store, historySince: "2025-11-22" });
const interpretAnswer = { merchantName: "Google ChatGPT", categoryId: tech, subscriptionId: null, billingCurrency: "USD", installmentsCount: 36, isInternational: true, confidence: "media", reason: "Los cobros de Google se facturan en dólares a 36 cuotas." };

describe("enrichDraft (step 43, R10)", () => {
  it("suggests from the merchant and prefix history without touching the facts", async () => {
    const { context, calls, usage } = fakeAi({ interpret: interpretAnswer });
    const { store, saved } = memoryStore(pending);
    await enrichDraft("d1", deps(context, store));
    expect(saved.facts).toBeUndefined();
    expect(saved.suggestions).toEqual({ ...interpretAnswer });
    expect(usage).toEqual(["interpretTransactionAlert:ok"]);
    const data = JSON.parse(String(calls[0]!.body.messages[0]!.content).replace(/^<data>\n|\n<\/data>$/g, ""));
    expect(data).toMatchObject({ merchant: "GOOGLE *ChatGPT", amount: "81000.00", currency: "COP", card: visa });
    // Only Google charges reach the model, with category names, never other merchants.
    expect(data.history).toEqual([{ merchant: "GOOGLE *YouTube", date: "2026-11-05", category: "Suscripciones", billedCurrency: "USD", installments: 36, amount: "13.99" }]);
    expect(data.subscriptions).toHaveLength(1);
    expect(calls[0]!.body).not.toHaveProperty("tools");
  });

  it("discards an answer that tries to change the amount, currency, date or card", async () => {
    const { context, usage } = fakeAi({ interpret: { ...interpretAnswer, amount: "1.00", currency: "USD", date: "2026-01-01", cardId: "otra" } });
    const { store, saved } = memoryStore(pending);
    await enrichDraft("d1", deps(context, store));
    expect(saved).toEqual({});
    expect(usage).toEqual(["interpretTransactionAlert:invalid_output"]);
  });

  it("drops ids outside the owner's lists", async () => {
    const { context } = fakeAi({ interpret: { ...interpretAnswer, categoryId: "inventada", subscriptionId: "66666666-6666-4666-8666-666666666666" } });
    const { store, saved } = memoryStore(pending);
    await enrichDraft("d1", deps(context, store));
    expect(saved.suggestions).toMatchObject({ categoryId: null, subscriptionId: null, merchantName: "Google ChatGPT" });
  });

  it("reads an unknown format, assigns the card by its digits and keeps it to review with suggestions", async () => {
    const review: EnrichableDraft = { ...pending, status: "needs_review", phrase: ALERTS.advance, cardId: null, last4: "1999", type: null, amount: null, currency: null, merchantRaw: null };
    const { context, calls } = fakeAi({
      extract: { type: "cash_advance", amountText: "200.000,00", currency: "COP", merchant: "CAJERO EJEMPLO", dateText: "21/11/2026", timeText: "18:40", last4: "1999" },
      interpret: { ...interpretAnswer, merchantName: null, categoryId: null, billingCurrency: null, installmentsCount: 1, isInternational: false, confidence: "baja", reason: null },
    });
    const { store, saved } = memoryStore(review, { cards: { "1999": [{ id: visa, cutoffDay: 15 }] } });
    await enrichDraft("d1", deps(context, store));
    expect(saved.facts).toEqual({ type: "cash_advance", amount: "200000.00", currency: "COP", merchant: "CAJERO EJEMPLO", date: "2026-11-21", time: "18:40", last4: "1999", cardId: visa, statementCutoff: "2026-12-15" });
    expect(calls.map((call) => call.task)).toEqual(["extract", "interpret"]);
    expect(saved.suggestions).toMatchObject({ installmentsCount: 1, confidence: "baja" });
  });

  it("saves nothing when the fallback invents a number", async () => {
    const review: EnrichableDraft = { ...pending, status: "needs_review", phrase: ALERTS.advance, type: null, amount: null, currency: null, merchantRaw: null };
    const { context, calls } = fakeAi({ extract: { type: "cash_advance", amountText: "250.000,00", currency: "COP", merchant: null, dateText: null, timeText: null, last4: null } });
    const { store, saved } = memoryStore(review);
    await enrichDraft("d1", deps(context, store));
    expect(saved).toEqual({});
    expect(calls.map((call) => call.task)).toEqual(["extract"]);
  });

  it("keeps the draft card and leaves a payment without installments", async () => {
    const review: EnrichableDraft = { ...pending, status: "needs_review", phrase: ALERTS.payment, type: null, amount: null, currency: null, merchantRaw: null };
    const { context } = fakeAi({
      extract: { type: "payment", amountText: "1.178.836,00", currency: "COP", merchant: "tu cuenta", dateText: "02/12/2026", timeText: "10:00", last4: "1999" },
      interpret: interpretAnswer,
    });
    const { store, saved } = memoryStore(review);
    await enrichDraft("d1", deps(context, store));
    expect(saved.facts).toMatchObject({ type: "payment", cardId: visa, statementCutoff: "2026-12-15" });
    expect(saved.suggestions).toMatchObject({ installmentsCount: null, isInternational: null });
  });

  it.each([
    ["without an API key", { client: false }],
    ["for a draft that is no longer open", { draft: null }],
    ["for a draft that already has suggestions", { draft: { ...pending, suggestions: { confidence: "alta" } } }],
    ["when the database fails", { fail: true }],
  ])("does nothing %s", async (_, options: { client?: boolean; draft?: EnrichableDraft | null; fail?: boolean }) => {
    const { context, calls } = fakeAi({ interpret: interpretAnswer }, options.client ?? true);
    const { store, saved } = memoryStore(options.draft === undefined ? pending : options.draft, { fail: options.fail });
    await expect(enrichDraft("d1", deps(context, store))).resolves.toBeUndefined();
    expect(saved).toEqual({});
    if (options.client !== false) expect(calls).toEqual([]);
  });
});

describe("sanitizeSuggestions", () => {
  it("returns null when the answer does not fit the stored schema", () => {
    expect(sanitizeSuggestions({ ...interpretAnswer, confidence: "alta", reason: "x".repeat(201) } as never, { categoryIds: [], subscriptionIds: [], allowsInstallments: true })).toBeNull();
  });
});
