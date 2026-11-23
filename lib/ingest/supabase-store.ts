import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { IngestStore } from "./ingest-alert";

/**
 * Ingest store with the service client (D51). RLS does not apply, so every query filters by the configured owner and
 * every row it writes carries that owner.
 */
export function supabaseIngestStore(supabase: SupabaseClient): IngestStore {
  return {
    async captureEnabled(userId) {
      const { data, error } = await supabase.from("capture_settings").select("enabled").eq("user_id", userId).maybeSingle();
      if (error) throw new Error("capture_settings");
      return (data as { enabled: boolean } | null)?.enabled === true;
    },
    async withinRateLimit(userId, limit) {
      const { data, error } = await supabase.rpc("ingest_rate_hit", { p_user_id: userId, p_limit: limit });
      if (error || typeof data !== "boolean") throw new Error("ingest_rate_hit");
      return data;
    },
    async cardsFor(userId, last4) {
      const aliases = await supabase.from("card_aliases").select("card_id").eq("user_id", userId).eq("last4", last4);
      if (aliases.error) throw new Error("card_aliases");
      const aliasIds = ((aliases.data ?? []) as Array<{ card_id: string }>).map((row) => row.card_id);
      const filter = aliasIds.length ? `last4.eq.${last4},id.in.(${aliasIds.join(",")})` : `last4.eq.${last4}`;
      const cards = await supabase.from("cards").select("id,cutoff_day").eq("user_id", userId).is("archived_at", null).or(filter);
      if (cards.error) throw new Error("cards");
      return ((cards.data ?? []) as Array<{ id: string; cutoff_day: number }>).map((row) => ({ id: row.id, cutoffDay: row.cutoff_day }));
    },
    async insertDraft(draft) {
      const { data, error } = await supabase.from("transaction_drafts").upsert(draft, { onConflict: "user_id,source,external_id", ignoreDuplicates: true }).select("id");
      if (error) throw new Error("transaction_drafts");
      return (data ?? []).length > 0;
    },
  };
}
