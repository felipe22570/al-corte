import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { readAiConfig, readAnthropicApiKey } from "../config";
import { createAnthropicClient } from "../context";
import type { AiUsageStore } from "../types";
import fixtures from "./fixtures/smoke.json";
import { accuracy, formatReport, runEval } from "./run-eval";
import { smokeCheckTask } from "./smoke-task";

/**
 * `pnpm test:ai`: calls the real API with fictitious phrases. The usage stays in memory (it does not write to
 * `ai_usage`) but the run still stops at the configured monthly budget.
 */
describe("AI evals", () => {
  it("smokeCheck answers every field", async () => {
    const apiKey = readAnthropicApiKey();
    if (!apiKey) throw new Error("Configura ANTHROPIC_API_KEY en .env.local para correr pnpm test:ai.");
    const config = readAiConfig();
    let spent = new Decimal(0);
    const usage: AiUsageStore = {
      spentSince: async () => spent,
      record: async (row) => {
        spent = spent.plus(row.costUsd);
      },
    };

    const report = await runEval(smokeCheckTask, fixtures, { userId: "evals", client: createAnthropicClient(apiKey), usage, config });
    process.stdout.write(formatReport(report, config.modelFor(smokeCheckTask.name)));
    process.stdout.write(`  costo estimado: US$ ${spent.toFixed(6)}\n`);

    expect(report.failures).toEqual({});
    for (const score of Object.values(report.fields)) expect(accuracy(score)).toBe(1);
  }, 120_000);
});
