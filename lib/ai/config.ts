import "server-only";

import Decimal from "decimal.js";

import type { AiConfig } from "./types";

/** Defaults approved by the owner on 2026-11-22 (step 40). */
export const DEFAULT_AI_MODEL = "claude-opus-5-5";
export const DEFAULT_MONTHLY_BUDGET_USD = "5";

type Env = Record<string, string | undefined>;

/** `interpretTransactionAlert` → `AI_MODEL_INTERPRET_TRANSACTION_ALERT`. */
export function modelVariable(taskName: string): string {
  return `AI_MODEL_${taskName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}`;
}

function budget(value: string | undefined): Decimal {
  const raw = value?.trim() || DEFAULT_MONTHLY_BUDGET_USD;
  if (!/^\d+(\.\d+)?$/.test(raw)) throw new Error("AI_MONTHLY_BUDGET_USD debe ser un valor en dólares, como 5 o 2.50.");
  return new Decimal(raw);
}

export function readAiConfig(env: Env = process.env): AiConfig {
  const monthlyBudgetUsd = budget(env.AI_MONTHLY_BUDGET_USD);
  const fallback = env.AI_MODEL_DEFAULT?.trim() || DEFAULT_AI_MODEL;
  return {
    monthlyBudgetUsd,
    modelFor: (taskName) => env[modelVariable(taskName)]?.trim() || fallback,
  };
}

export function readAnthropicApiKey(env: Env = process.env): string | null {
  return env.ANTHROPIC_API_KEY?.trim() || null;
}
