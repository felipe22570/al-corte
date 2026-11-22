import "server-only";

import Decimal from "decimal.js";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiUsageStore } from "./types";

/**
 * `ai_usage` through Supabase. With a session client RLS limits it to the owner; the ingest route (step 42) passes
 * the service client and the configured owner (D51). Only metadata is stored, never content (D42).
 */
export function supabaseUsageStore(supabase: SupabaseClient): AiUsageStore {
  return {
    async spentSince(userId, since) {
      const { data, error } = await supabase.rpc("ai_usage_spent_since", { p_user_id: userId, p_since: since.toISOString() });
      if (error || typeof data !== "string") throw new Error("No se pudo leer el gasto de IA.");
      return new Decimal(data);
    },
    async record(row) {
      const { error } = await supabase.from("ai_usage").insert({
        user_id: row.userId, task: row.task, prompt_version: row.promptVersion, model: row.model,
        input_tokens: row.inputTokens, output_tokens: row.outputTokens, latency_ms: row.latencyMs, result: row.result,
        // Sent as text so PostgREST stores the exact decimals of `numeric`.
        cost_usd: row.costUsd.toFixed(6),
      });
      if (error) throw new Error("No se pudo registrar el uso de IA.");
    },
  };
}
