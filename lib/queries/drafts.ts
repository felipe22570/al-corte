import type { DraftForForm } from "@/lib/draft-form";
import type { IsoDate } from "@/lib/domain/dates";
import { sameMovementCandidates, subscriptionAmountChange, type AmountChange } from "@/lib/domain/drafts";
import type { Currency } from "@/lib/domain/money";
import type { createClient } from "@/lib/supabase/server";
import { parseDraftSuggestions, type DraftSuggestions, type OpenDraftStatus } from "@/lib/validation/transaction-draft";
import type { TransactionInput } from "@/lib/validation/transaction";

type Client = Awaited<ReturnType<typeof createClient>>;

/** Only drafts still waiting for the owner. Statements, months, totals and credit never read this table (D46). */
export const OPEN_DRAFT_STATUSES: readonly OpenDraftStatus[] = ["pending", "needs_review", "unknown_card"];

type RawDraft = {
  id: string; status: OpenDraftStatus; phrase: string; card_id: string | null; last4: string | null; type: TransactionInput["type"] | null;
  amount: string | null; currency: Currency | null; merchant_raw: string | null; occurred_on: IsoDate | null; occurred_time: string | null;
  statement_cutoff: IsoDate | null; suggestions: unknown; created_at: string;
};
type RawCandidate = { id: string; card_id: string; amount: string; currency: Currency; date: IsoDate; merchant: string | null; type: string };

export type DraftCandidateRow = { id: string; cardId: string; amount: string; currency: Currency; date: IsoDate; merchant: string | null; linked: boolean };
export type InboxDraft = {
  id: string; status: OpenDraftStatus; phrase: string; cardId: string | null; last4: string | null; type: TransactionInput["type"] | null;
  amount: string | null; currency: Currency | null; merchantRaw: string | null; occurredOn: IsoDate | null; occurredTime: string | null;
  statementCutoff: IsoDate | null; suggestions: DraftSuggestions | null; createdAt: string;
  /** Facts read by the AI fallback: rules never fill a draft to review, so these come from the AI (step 43). */
  readByAi: boolean;
  candidates: DraftCandidateRow[];
  subscription: { name: string; change: AmountChange | null } | null;
};

const DRAFT_COLUMNS = "id,status,phrase,card_id,last4,type,amount::text,currency,merchant_raw,occurred_on,occurred_time,statement_cutoff,suggestions,created_at";

export async function countOpenDrafts(supabase: Client, userId: string): Promise<number> {
  const { count, error } = await supabase.from("transaction_drafts").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", OPEN_DRAFT_STATUSES);
  if (error) throw new Error("No pudimos consultar los movimientos por confirmar.");
  return count ?? 0;
}

async function enrich(supabase: Client, userId: string, raws: RawDraft[]): Promise<InboxDraft[]> {
  const drafts = raws.map((raw) => ({ raw, suggestions: parseDraftSuggestions(raw.suggestions) }));
  const facts = drafts.filter(({ raw }) => raw.card_id && raw.amount && raw.currency && raw.occurred_on);
  const subscriptionIds = [...new Set(drafts.flatMap(({ suggestions }) => suggestions?.subscriptionId ? [suggestions.subscriptionId] : []))];
  const [candidatesResult, subscriptionsResult] = await Promise.all([
    facts.length
      ? supabase.from("transactions").select("id,card_id,amount::text,currency,date,merchant,type").eq("user_id", userId)
        .in("card_id", [...new Set(facts.map(({ raw }) => raw.card_id!))]).in("date", [...new Set(facts.map(({ raw }) => raw.occurred_on!))]).neq("type", "advance_fee")
      : Promise.resolve({ data: [], error: null }),
    subscriptionIds.length
      ? supabase.from("subscriptions").select("id,name,amount::text,currency").eq("user_id", userId).in("id", subscriptionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (candidatesResult.error || subscriptionsResult.error) throw new Error("No pudimos consultar los movimientos por confirmar.");
  const rawCandidates = (candidatesResult.data ?? []) as RawCandidate[];
  let linked = new Set<string>();
  if (rawCandidates.length) {
    const { data, error } = await supabase.from("transaction_drafts").select("transaction_id").eq("user_id", userId).in("transaction_id", rawCandidates.map((row) => row.id));
    if (error) throw new Error("No pudimos consultar los movimientos por confirmar.");
    linked = new Set(((data ?? []) as Array<{ transaction_id: string }>).map((row) => row.transaction_id));
  }
  const candidates: DraftCandidateRow[] = rawCandidates.map((row) => ({ id: row.id, cardId: row.card_id, amount: row.amount, currency: row.currency, date: row.date, merchant: row.merchant, linked: linked.has(row.id) }));
  const subscriptions = new Map(((subscriptionsResult.data ?? []) as Array<{ id: string; name: string; amount: string; currency: Currency }>).map((row) => [row.id, row]));

  return drafts.map(({ raw, suggestions }) => {
    const related = suggestions?.subscriptionId ? subscriptions.get(suggestions.subscriptionId) : undefined;
    return {
      id: raw.id, status: raw.status, phrase: raw.phrase, cardId: raw.card_id, last4: raw.last4, type: raw.type, amount: raw.amount,
      currency: raw.currency, merchantRaw: raw.merchant_raw, occurredOn: raw.occurred_on, occurredTime: raw.occurred_time?.slice(0, 5) ?? null,
      statementCutoff: raw.statement_cutoff, suggestions, createdAt: raw.created_at, readByAi: raw.status === "needs_review" && raw.amount !== null,
      candidates: sameMovementCandidates({ cardId: raw.card_id, amount: raw.amount, currency: raw.currency, date: raw.occurred_on }, candidates),
      subscription: related ? { name: related.name, change: subscriptionAmountChange({ amount: raw.amount, currency: raw.currency }, related) } : null,
    };
  });
}

/** The inbox "Por confirmar" (F18): newest first, with possible duplicates and the related subscription. */
export async function loadOpenDrafts(supabase: Client, userId: string): Promise<InboxDraft[]> {
  const { data, error } = await supabase.from("transaction_drafts").select(DRAFT_COLUMNS).eq("user_id", userId).in("status", OPEN_DRAFT_STATUSES)
    .order("created_at", { ascending: false }).limit(200);
  if (error) throw new Error("No pudimos consultar los movimientos por confirmar.");
  return enrich(supabase, userId, (data ?? []) as unknown as RawDraft[]);
}

export async function loadOpenDraft(supabase: Client, userId: string, id: string): Promise<InboxDraft | null> {
  const { data, error } = await supabase.from("transaction_drafts").select(DRAFT_COLUMNS).eq("user_id", userId).eq("id", id).in("status", OPEN_DRAFT_STATUSES).maybeSingle();
  if (error) throw new Error("No pudimos consultar el movimiento por confirmar.");
  if (!data) return null;
  const [draft] = await enrich(supabase, userId, [data as unknown as RawDraft]);
  return draft ?? null;
}

/** What the capture proposed for an open draft, to measure which fields the owner corrected on confirming (step 45). */
export async function loadDraftProposal(supabase: Client, userId: string, id: string): Promise<DraftForForm | null> {
  const { data, error } = await supabase.from("transaction_drafts").select("card_id,type,amount::text,currency,merchant_raw,occurred_on,suggestions")
    .eq("user_id", userId).eq("id", id).in("status", OPEN_DRAFT_STATUSES).maybeSingle();
  if (error || !data) return null;
  const raw = data as unknown as Pick<RawDraft, "card_id" | "type" | "amount" | "currency" | "merchant_raw" | "occurred_on" | "suggestions">;
  return { cardId: raw.card_id, type: raw.type, amount: raw.amount, currency: raw.currency, merchantRaw: raw.merchant_raw, occurredOn: raw.occurred_on, suggestions: parseDraftSuggestions(raw.suggestions) };
}
