import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url).pathname;
const sourceDirs = ["app", "components", "lib"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const importsAi = /from\s+["'](?:@\/lib\/ai(?:\/[^"']*)?|(?:\.{1,2}\/)+(?:lib\/)?ai(?:\/[^"']*)?)["']|import\(\s*["']@\/lib\/ai/;

describe("lib/ai stays on the server (D42)", () => {
  it("every module of lib/ai declares server-only", () => {
    const modules = sourceFiles(join(root, "lib/ai")).filter((path) => !path.includes("__tests__") && !path.includes("/evals/"));
    expect(modules.length).toBeGreaterThan(0);
    const missing = modules.filter((path) => !readFileSync(path, "utf8").startsWith('import "server-only";'));
    expect(missing.map((path) => relative(root, path))).toEqual([]);
  });

  it("no client component imports lib/ai", () => {
    const offenders = sourceDirs.flatMap((dir) => sourceFiles(join(root, dir)))
      .filter((path) => /^\s*["']use client["']/.test(readFileSync(path, "utf8")))
      .filter((path) => importsAi.test(readFileSync(path, "utf8")));
    expect(offenders.map((path) => relative(root, path))).toEqual([]);
  });

  it("detects the import forms it guards against", () => {
    expect(importsAi.test('import { runTask } from "@/lib/ai/run-task";')).toBe(true);
    expect(importsAi.test('import { runTask } from "@/lib/ai";')).toBe(true);
    expect(importsAi.test('import { runTask } from "../../lib/ai/run-task";')).toBe(true);
    expect(importsAi.test('const ai = await import("@/lib/ai/run-task");')).toBe(true);
    expect(importsAi.test('import { formatCop } from "@/lib/format";')).toBe(false);
  });
});
