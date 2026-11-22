import Decimal from "decimal.js";
import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import { z } from "zod";

import type { AiClient, AiContext, AiTask, AiUsageRecord, AiUsageStore } from "../types";

export const testTask: AiTask<z.ZodObject<{ phrase: z.ZodString }>, z.ZodObject<{ merchant: z.ZodString; amount: z.ZodString }>> = {
  name: "testTask",
  promptVersion: "v1",
  maxTokens: 200,
  input: z.object({ phrase: z.string().min(1).max(200) }),
  output: z.object({ merchant: z.string().min(1).max(60), amount: z.string().regex(/^\d+$/) }),
  system: "Extrae el comercio y el valor.",
  data: (input) => input.phrase,
};

export function message(text: string, overrides: Partial<Message> = {}): Message {
  return {
    id: "msg_test", type: "message", role: "assistant", model: "claude-opus-5-5",
    content: [{ type: "text", text, citations: null }],
    stop_reason: "end_turn", stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 100, cache_creation_input_tokens: null, cache_read_input_tokens: null },
    ...overrides,
  } as unknown as Message;
}

export function fakeClient(answer: () => Promise<Message>) {
  const calls: MessageCreateParamsNonStreaming[] = [];
  const client: AiClient = {
    messages: {
      create: (body) => {
        calls.push(body);
        return answer();
      },
    },
  };
  return { client, calls };
}

export function memoryUsage(spent = "0") {
  const rows: AiUsageRecord[] = [];
  const store: AiUsageStore = {
    spentSince: async () => new Decimal(spent),
    record: async (row) => {
      rows.push(row);
    },
  };
  return { store, rows };
}

export function context(client: AiClient | null, usage: AiUsageStore, budget = "5"): AiContext {
  let tick = 0;
  return {
    userId: "00000000-0000-0000-0000-000000000040",
    client,
    usage,
    config: { monthlyBudgetUsd: new Decimal(budget), modelFor: () => "claude-opus-5-5" },
    // Each call to `now` advances 250 ms, so latency is deterministic.
    now: () => new Date(Date.UTC(2026, 10, 22, 15, 0, 0) + 250 * tick++),
  };
}
