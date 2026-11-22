import { describe, expect, it } from "vitest";

import { startOfBogotaMonth } from "../budget";
import { DEFAULT_AI_MODEL, modelVariable, readAiConfig, readAnthropicApiKey } from "../config";
import { estimateCostUsd, hasKnownPrice } from "../pricing";

describe("AI configuration", () => {
  it("defaults to Opus and a US$5 monthly budget", () => {
    const config = readAiConfig({});
    expect(DEFAULT_AI_MODEL).toBe("claude-opus-5-5");
    expect(config.modelFor("interpretTransactionAlert")).toBe("claude-opus-5-5");
    expect(config.monthlyBudgetUsd.toFixed(2)).toBe("5.00");
  });

  it("chooses the model per task, then the default variable", () => {
    const config = readAiConfig({ AI_MODEL_DEFAULT: "claude-sonnet-5-5", AI_MODEL_INTERPRET_TRANSACTION_ALERT: " claude-haiku-5-5 ", AI_MONTHLY_BUDGET_USD: "2.50" });
    expect(modelVariable("interpretTransactionAlert")).toBe("AI_MODEL_INTERPRET_TRANSACTION_ALERT");
    expect(modelVariable("smokeCheck")).toBe("AI_MODEL_SMOKE_CHECK");
    expect(config.modelFor("interpretTransactionAlert")).toBe("claude-haiku-5-5");
    expect(config.modelFor("extractUnknownAlert")).toBe("claude-sonnet-5-5");
    expect(config.monthlyBudgetUsd.toFixed(2)).toBe("2.50");
  });

  it.each(["-1", "5 USD", "cinco", "1,5"])("rejects the budget %s", (value) => {
    expect(() => readAiConfig({ AI_MONTHLY_BUDGET_USD: value })).toThrow("AI_MONTHLY_BUDGET_USD");
  });

  it("reads the API key only when it has a value", () => {
    expect(readAnthropicApiKey({})).toBeNull();
    expect(readAnthropicApiKey({ ANTHROPIC_API_KEY: "  " })).toBeNull();
    expect(readAnthropicApiKey({ ANTHROPIC_API_KEY: "sk-ant-ficticia" })).toBe("sk-ant-ficticia");
  });
});

describe("AI pricing", () => {
  const usage = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheWriteTokens: 0, cacheReadTokens: 0 };

  it("prices each model per million tokens", () => {
    expect(estimateCostUsd("claude-opus-5-5", usage).toFixed(6)).toBe("24.000000");
    expect(estimateCostUsd("claude-sonnet-5-5", usage).toFixed(6)).toBe("12.000000");
    expect(estimateCostUsd("claude-opus-5-5", { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 1_000_000, cacheReadTokens: 1_000_000 }).toFixed(6)).toBe("5.200000");
  });

  it("uses the long context price of Haiku above 100,000 input tokens", () => {
    expect(estimateCostUsd("claude-haiku-5-5", { inputTokens: 100_000, outputTokens: 1_000, cacheWriteTokens: 0, cacheReadTokens: 0 }).toFixed(6)).toBe("0.010500");
    expect(estimateCostUsd("claude-haiku-5-5", { inputTokens: 100_001, outputTokens: 1_000, cacheWriteTokens: 0, cacheReadTokens: 0 }).toFixed(6)).toBe("0.052501");
  });

  it("rounds up so the budget never undercounts", () => {
    expect(estimateCostUsd("claude-haiku-5-5", { inputTokens: 1, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 }).toFixed(6)).toBe("0.000001");
  });

  it("knows only listed models", () => {
    expect(hasKnownPrice("claude-opus-5-5")).toBe(true);
    expect(hasKnownPrice("toString")).toBe(false);
    expect(() => estimateCostUsd("claude-desconocido", usage)).toThrow("Modelo sin precio conocido");
  });
});

describe("startOfBogotaMonth", () => {
  it.each([
    ["2026-11-22T15:00:00Z", "2026-11-01T05:00:00.000Z"],
    ["2026-12-01T04:59:59Z", "2026-11-01T05:00:00.000Z"],
    ["2026-12-01T05:00:00Z", "2026-12-01T05:00:00.000Z"],
    ["2027-01-01T03:00:00Z", "2026-12-01T05:00:00.000Z"],
  ])("at %s the month started at %s", (now, start) => {
    expect(startOfBogotaMonth(new Date(now)).toISOString()).toBe(start);
  });
});
