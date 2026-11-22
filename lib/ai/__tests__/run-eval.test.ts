import { describe, expect, it } from "vitest";

import { accuracy, formatReport, runEval } from "../evals/run-eval";
import { context, fakeClient, memoryUsage, message, testTask } from "./fakes";

describe("runEval", () => {
  it("scores each field and counts failed calls as misses without showing answers", async () => {
    const answers = [
      message(JSON.stringify({ merchant: "TIENDA", amount: "100" })),
      message(JSON.stringify({ merchant: "OTRA", amount: "999" })),
      message("no es JSON"),
    ];
    const { client } = fakeClient(() => Promise.resolve(answers.shift()!));
    const { store } = memoryUsage();
    const report = await runEval(testTask, [
      { name: "acierta", input: { phrase: "TIENDA 100" }, expected: { merchant: "TIENDA", amount: "100" } },
      { name: "valor errado", input: { phrase: "OTRA 200" }, expected: { merchant: "OTRA", amount: "200" } },
      { name: "sin respuesta", input: { phrase: "CAFE 300" }, expected: { merchant: "CAFE", amount: "300" } },
    ], context(client, store));

    expect(report.fields).toEqual({ merchant: { hits: 2, total: 3 }, amount: { hits: 1, total: 3 } });
    expect(report.failures).toEqual({ invalid_output: 1 });
    expect(report.missed).toEqual(["valor errado", "sin respuesta"]);
    expect(accuracy(report.fields.amount!)).toBeCloseTo(1 / 3);
    expect(accuracy({ hits: 0, total: 0 })).toBe(0);

    const text = formatReport(report, "claude-opus-5-5");
    expect(text).toContain("testTask (v1, claude-opus-5-5): 3 casos");
    expect(text).toMatch(/merchant\s+2\/3\s+67%/);
    expect(text).toContain("sin respuesta: invalid_output 1");
    expect(text).not.toContain("999");
  });

  it("reports a clean run without failure lines", async () => {
    const { client } = fakeClient(() => Promise.resolve(message(JSON.stringify({ merchant: "TIENDA", amount: "100" }))));
    const { store } = memoryUsage();
    const report = await runEval(testTask, [{ name: "acierta", input: { phrase: "TIENDA 100" }, expected: { merchant: "TIENDA" } }], context(client, store));
    expect(formatReport(report, "claude-opus-5-5")).toBe("testTask (v1, claude-opus-5-5): 1 casos\n  merchant                   1/1  100%\n");
  });
});
