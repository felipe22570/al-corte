import "server-only";

import Decimal from "decimal.js";

type Rates = { input: string; output: string; cacheWrite: string; cacheRead: string };
type ModelPrice = Rates & { longContext?: { aboveInputTokens: number } & Rates };

/**
 * USD per million tokens, from https://platform.claude.com/docs/en/about-claude/pricing (checked on 2026-11-22).
 * A model missing here is refused, so no call goes uncounted against the monthly budget.
 */
export const MODEL_PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { input: "4", output: "20", cacheWrite: "5", cacheRead: "0.20" },
  "claude-sonnet-5-5": { input: "2", output: "10", cacheWrite: "2.50", cacheRead: "0.10" },
  "claude-haiku-5-5": {
    input: "0.10", output: "0.50", cacheWrite: "0.125", cacheRead: "0.01",
    longContext: { aboveInputTokens: 100_000, input: "0.50", output: "2.50", cacheWrite: "0.625", cacheRead: "0.05" },
  },
};

export type TokenUsage = { inputTokens: number; outputTokens: number; cacheWriteTokens: number; cacheReadTokens: number };

export function hasKnownPrice(model: string): boolean {
  return Object.hasOwn(MODEL_PRICES, model);
}

/** Total input tokens of a call, the way the API counts them for long context pricing. */
export function totalInputTokens(usage: TokenUsage): number {
  return usage.inputTokens + usage.cacheWriteTokens + usage.cacheReadTokens;
}

/** Estimated cost in USD, rounded up to 6 decimals so the budget never undercounts. */
export function estimateCostUsd(model: string, usage: TokenUsage): Decimal {
  const price = MODEL_PRICES[model];
  if (!price) throw new Error(`Modelo sin precio conocido: ${model}`);
  const rates = price.longContext && totalInputTokens(usage) > price.longContext.aboveInputTokens ? price.longContext : price;
  return new Decimal(usage.inputTokens).times(rates.input)
    .plus(new Decimal(usage.outputTokens).times(rates.output))
    .plus(new Decimal(usage.cacheWriteTokens).times(rates.cacheWrite))
    .plus(new Decimal(usage.cacheReadTokens).times(rates.cacheRead))
    .dividedBy(1_000_000)
    .toDecimalPlaces(6, Decimal.ROUND_UP);
}
