import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { runTask } from "../run-task";
import { supabaseUsageStore } from "../usage";
import { context, fakeClient, message, testTask } from "./fakes";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("ai_usage against local Supabase", () => {
  it("logs calls with exact cost and stops at the budget (D42)", async () => {
    const userId = randomUUID();
    const sql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A"], { input, encoding: "utf8" });
    const env = Object.fromEntries(execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" }).split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    if (!env.ANON_KEY || !env.JWT_SECRET) throw new Error("Falta configuración local de Supabase.");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const signature = createHmac("sha256", env.JWT_SECRET).update(`${header}.${claims}`).digest("base64url");
    const supabase = createClient("http://127.0.0.1:54321", env.ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${header}.${claims}.${signature}` } } });
    sql(`insert into auth.users (id, email) values ('${userId}', 'ai-usage-${userId}@example.com');`);

    try {
      const usage = supabaseUsageStore(supabase);
      const { client, calls } = fakeClient(() => Promise.resolve(message(JSON.stringify({ merchant: "Tienda Ficticia", amount: "12345" }), {
        usage: { input_tokens: 333, output_tokens: 77, cache_creation_input_tokens: null, cache_read_input_tokens: null } as never,
      })));
      const ctx = { ...context(client, usage, "0.002"), userId, now: () => new Date() };

      expect((await runTask(testTask, { phrase: "Pagaste 12345 en Tienda Ficticia" }, ctx)).ok).toBe(true);
      // 333 × 4 / 1M + 77 × 20 / 1M = 0.002872 USD, above the 0.002 budget: the next call does not reach the API.
      expect((await usage.spentSince(userId, new Date(Date.now() - 60_000))).equals(new Decimal("0.002872"))).toBe(true);
      expect(await runTask(testTask, { phrase: "Pagaste 1 en Otra" }, ctx)).toEqual({ ok: false, reason: "budget_exceeded" });
      expect(calls).toHaveLength(1);

      const rows = sql(`select result || '|' || input_tokens || '|' || output_tokens || '|' || cost_usd from public.ai_usage where user_id = '${userId}' order by created_at;`).trim().split("\n");
      expect(rows).toEqual(["ok|333|77|0.002872", "budget_exceeded|0|0|0.000000"]);
    } finally {
      sql(`delete from auth.users where id = '${userId}';`);
    }
  });
});
