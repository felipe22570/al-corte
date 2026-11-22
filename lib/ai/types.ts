import "server-only";

import type Decimal from "decimal.js";
import type { Message, MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages/messages";
import type { z } from "zod";

/**
 * A named AI task (F19, D42): versioned prompt, Zod schemas for input and output and a token limit. The model comes
 * from the server configuration, never from the task, so it can change without touching the code.
 */
export type AiTask<Input extends z.ZodType, Output extends z.ZodType> = {
  /** camelCase name; also selects the model variable `AI_MODEL_<NAME_IN_SNAKE_CASE>`. */
  name: string;
  promptVersion: string;
  maxTokens: number;
  input: Input;
  output: Output;
  /** Instructions for the model. External content never goes here. */
  system: string;
  /** External content for the model, already validated. `runTask` wraps it in delimiters as data. */
  data: (input: z.output<Input>) => string;
};

export type AiFailureReason =
  | "invalid_input"
  | "not_configured"
  | "unknown_model"
  | "usage_unavailable"
  | "budget_exceeded"
  | "timeout"
  | "api_error"
  | "invalid_output";

export type AiTaskResult<Output> = { ok: true; data: Output } | { ok: false; reason: AiFailureReason };

/** Results stored in `ai_usage`: only the ones where the API was called or the budget stopped the call. */
export type AiUsageResult = "ok" | "invalid_output" | "api_error" | "timeout" | "budget_exceeded";

/** One row of the usage log. Never carries prompts, inputs or outputs. */
export type AiUsageRecord = {
  userId: string;
  task: string;
  promptVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: Decimal;
  latencyMs: number;
  result: AiUsageResult;
};

export type AiUsageStore = {
  spentSince: (userId: string, since: Date) => Promise<Decimal>;
  record: (row: AiUsageRecord) => Promise<void>;
};

/** The part of the Anthropic client the layer uses, so tests can replace it. */
export type AiClient = {
  messages: { create: (body: MessageCreateParamsNonStreaming) => PromiseLike<Message> };
};

export type AiConfig = {
  monthlyBudgetUsd: Decimal;
  modelFor: (taskName: string) => string;
};

export type AiContext = {
  userId: string;
  /** `null` when `ANTHROPIC_API_KEY` is missing: tasks answer `not_configured` and callers continue without AI (R10). */
  client: AiClient | null;
  usage: AiUsageStore;
  config: AiConfig;
  now?: () => Date;
};
