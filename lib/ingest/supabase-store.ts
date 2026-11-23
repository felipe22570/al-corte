import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { IsoDate } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";

import type { EnrichableDraft, EnrichStore } from "./ai-enrichment";
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
      return ((data ?? []) as Array<{ id: string }>)[0]?.id ?? null;
    },
  };
}

type RawEnrichDraft = {
  id: string; status: EnrichableDraft["status"]; phrase: string; card_id: string | null; last4: string | null; type: string | null;
  amount: string | null; currency: Currency | null; merchant_raw: string | null; suggestions: unknown;
};
type RawHistory = { merchant: string; date: IsoDate; category_id: string | null; currency: Currency; installments_count: number; original_installments_count: number | null; amount: string };

/** Store of the AI step (step 43), with the service client: every query and update is limited to the owner and to open drafts. */
export function supabaseEnrichStore(supabase: SupabaseClient): EnrichStore {
  const ingest = supabaseIngestStore(supabase);
  return {
    async loadDraft(userId, draftId) {
      const { data, error } = await supabase.from("transaction_drafts").select("id,status,phrase,card_id,last4,type,amount::text,currency,merchant_raw,suggestions")
        .eq("user_id", userId).eq("id", draftId).in("status", ["pending", "needs_review", "unknown_card"]).maybeSingle();
      if (error) throw new Error("transaction_drafts");
      const raw = data as RawEnrichDraft | null;
      return raw && { id: raw.id, status: raw.status, phrase: raw.phrase, cardId: raw.card_id, last4: raw.last4, type: raw.type, amount: raw.amount, currency: raw.currency, merchantRaw: raw.merchant_raw, suggestions: raw.suggestions };
    },
    async categories(userId) {
      const { data, error } = await supabase.from("categories").select("id,name").eq("user_id", userId).is("archived_at", null).order("name");
      if (error) throw new Error("categories");
      return (data ?? []) as Array<{ id: string; name: string }>;
    },
    async subscriptions(userId, cardId) {
      const { data, error } = await supabase.from("subscriptions").select("id,name,amount::text,currency,installments_count").eq("user_id", userId).eq("card_id", cardId).eq("status", "active").order("name").limit(50);
      if (error) throw new Error("subscriptions");
      return ((data ?? []) as Array<{ id: string; name: string; amount: string; currency: Currency; installments_count: number }>).map((row) => ({ id: row.id, name: row.name, amount: row.amount, currency: row.currency, installments: row.installments_count }));
    },
    async history(userId, since) {
      const { data, error } = await supabase.from("transactions").select("merchant,date,category_id,currency,installments_count,original_installments_count,amount::text")
        .eq("user_id", userId).in("type", ["purchase", "cash_advance"]).not("merchant", "is", null).gte("date", since).order("date", { ascending: false }).limit(1000);
      if (error) throw new Error("transactions");
      return ((data ?? []) as RawHistory[]).map((row) => ({ merchant: row.merchant, date: row.date, categoryId: row.category_id, currency: row.currency, installments: row.original_installments_count ?? row.installments_count, amount: row.amount }));
    },
    cardsFor: ingest.cardsFor,
    async card(userId, cardId) {
      const { data, error } = await supabase.from("cards").select("id,cutoff_day").eq("user_id", userId).eq("id", cardId).is("archived_at", null).maybeSingle();
      if (error) throw new Error("cards");
      const raw = data as { id: string; cutoff_day: number } | null;
      return raw && { id: raw.id, cutoffDay: raw.cutoff_day };
    },
    async saveReadFacts(userId, draftId, facts) {
      const { error } = await supabase.from("transaction_drafts").update({
        card_id: facts.cardId, last4: facts.last4, type: facts.type, amount: facts.amount, currency: facts.currency, merchant_raw: facts.merchant,
        occurred_on: facts.date, occurred_time: facts.time, statement_cutoff: facts.statementCutoff,
      }).eq("user_id", userId).eq("id", draftId).eq("status", "needs_review").is("amount", null);
      if (error) throw new Error("transaction_drafts");
    },
    async saveSuggestions(userId, draftId, suggestions) {
      const { error } = await supabase.from("transaction_drafts").update({ suggestions }).eq("user_id", userId).eq("id", draftId)
        .in("status", ["pending", "needs_review", "unknown_card"]).is("suggestions", null);
      if (error) throw new Error("transaction_drafts");
    },
  };
}
