import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig } from "vitest/config";

// `pnpm test:ai` (step 40): only the AI variables of .env.local reach the evals; `pnpm test` never runs them.
const local = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const aiEnv = Object.fromEntries(Object.entries({ ...local, ...process.env })
  .filter((entry): entry is [string, string] => typeof entry[1] === "string" && (entry[0] === "ANTHROPIC_API_KEY" || entry[0].startsWith("AI_"))));

export default defineConfig({
  resolve: {
    alias: {
      "@": new URL("./", import.meta.url).pathname,
      "server-only": new URL("./node_modules/server-only/empty.js", import.meta.url).pathname,
    },
  },
  test: {
    environment: "node",
    include: ["lib/ai/evals/**/*.eval.ts"],
    env: { TZ: "UTC", ...aiEnv },
    testTimeout: 120_000,
  },
});
