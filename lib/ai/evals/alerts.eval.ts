import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { verifyExtraction } from "@/lib/ingest/literal";
import { readAiConfig, readAnthropicApiKey } from "../config";
import { createAnthropicClient } from "../context";
import { runTask } from "../run-task";
import { extractUnknownAlertTask } from "../tasks/extract-unknown-alert";
import { interpretTransactionAlertTask } from "../tasks/interpret-transaction-alert";
import type { AiContext, AiUsageStore } from "../types";
import fixtures from "./fixtures/alerts.json";
import { accuracy, formatReport, runEval } from "./run-eval";

/**
 * `pnpm test:ai` (step 43): fictitious alerts against the real model. Every field must reach 80 % and the injection
 * cases must not move any scored field. Usage stays in memory, under the configured monthly budget.
 */
let spent = new Decimal(0);
function evalContext(): AiContext {
  const apiKey = readAnthropicApiKey();
  if (!apiKey) throw new Error("Configura ANTHROPIC_API_KEY en .env.local para correr pnpm test:ai.");
  const usage: AiUsageStore = { spentSince: async () => spent, record: async (row) => { spent = spent.plus(row.costUsd); } };
  return { userId: "evals", client: createAnthropicClient(apiKey), usage, config: readAiConfig() };
}
const MIN_ACCURACY = 0.8;

describe("alert evals", () => {
  it("interpretTransactionAlert suggests from history and subscriptions", async () => {
    const ctx = evalContext();
    const cases = fixtures.interpret.map((item) => ({ ...item, input: { ...item.input, categories: fixtures.categories } }));
    const report = await runEval(interpretTransactionAlertTask, cases, ctx);
    process.stdout.write(formatReport(report, ctx.config.modelFor(interpretTransactionAlertTask.name)));
    expect(report.failures).toEqual({});
    for (const [field, score] of Object.entries(report.fields)) expect(accuracy(score), field).toBeGreaterThanOrEqual(MIN_ACCURACY);
    expect(report.missed).not.toContain("Instruccion dentro del comercio");
  }, 180_000);

  it("extractUnknownAlert copies the numbers literally", async () => {
    const ctx = evalContext();
    const report = await runEval(extractUnknownAlertTask, fixtures.extract, ctx);
    process.stdout.write(formatReport(report, ctx.config.modelFor(extractUnknownAlertTask.name)));
    expect(report.failures).toEqual({});
    for (const [field, score] of Object.entries(report.fields)) expect(accuracy(score), field).toBeGreaterThanOrEqual(MIN_ACCURACY);
    expect(report.missed).not.toContain("Instruccion dentro de la alerta");
  }, 180_000);

  it("the extracted answers pass the literal verification", async () => {
    const ctx = evalContext();
    let verified = 0;
    for (const item of fixtures.extract) {
      const result = await runTask(extractUnknownAlertTask, item.input, ctx);
      if (result.ok && verifyExtraction(item.input.phrase, result.data)) verified += 1;
    }
    process.stdout.write(`  verificación literal: ${verified}/${fixtures.extract.length}\n  costo estimado acumulado: US$ ${spent.toFixed(6)}\n`);
    expect(verified).toBe(fixtures.extract.length);
  }, 180_000);
});
