import "server-only";

import type { z } from "zod";

import { runTask } from "../run-task";
import type { AiContext, AiFailureReason, AiTask } from "../types";

/** `expected` lists only the fields to score, with their exact values (JSON fixtures). */
export type EvalCase = { name: string; input: unknown; expected: Record<string, unknown> };
export type FieldScore = { hits: number; total: number };
export type EvalReport = {
  task: string;
  promptVersion: string;
  cases: number;
  /** Per output field: cases where the answer matched the expected value exactly. */
  fields: Record<string, FieldScore>;
  failures: Partial<Record<AiFailureReason, number>>;
  /** Case names with at least one wrong field or no answer; never the answers themselves. */
  missed: string[];
};

function same(actual: unknown, expected: unknown): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

/** Runs the real task over the fixtures and scores each field (F19). A failed call counts as a miss in every field. */
export async function runEval<Input extends z.ZodType, Output extends z.ZodType>(
  task: AiTask<Input, Output>,
  cases: ReadonlyArray<EvalCase>,
  ctx: AiContext,
): Promise<EvalReport> {
  const report: EvalReport = { task: task.name, promptVersion: task.promptVersion, cases: cases.length, fields: {}, failures: {}, missed: [] };
  for (const testCase of cases) {
    const result = await runTask(task, testCase.input, ctx);
    let missed = !result.ok;
    if (!result.ok) report.failures[result.reason] = (report.failures[result.reason] ?? 0) + 1;
    for (const [field, expected] of Object.entries(testCase.expected)) {
      const score = (report.fields[field] ??= { hits: 0, total: 0 });
      score.total += 1;
      if (result.ok && same((result.data as Record<string, unknown>)[field], expected)) score.hits += 1;
      else missed = true;
    }
    if (missed) report.missed.push(testCase.name);
  }
  return report;
}

export function accuracy(score: FieldScore): number {
  return score.total === 0 ? 0 : score.hits / score.total;
}

export function formatReport(report: EvalReport, model: string): string {
  const lines = [`${report.task} (${report.promptVersion}, ${model}): ${report.cases} casos`];
  for (const [field, score] of Object.entries(report.fields)) {
    lines.push(`  ${field.padEnd(24)} ${String(score.hits).padStart(3)}/${score.total}  ${Math.round(accuracy(score) * 100)}%`);
  }
  const failures = Object.entries(report.failures);
  if (failures.length) lines.push(`  sin respuesta: ${failures.map(([reason, count]) => `${reason} ${count}`).join(", ")}`);
  if (report.missed.length) lines.push(`  casos con fallas: ${report.missed.join(", ")}`);
  return `${lines.join("\n")}\n`;
}
