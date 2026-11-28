import type { ServerClient } from "@/lib/supabase/require-user";
import { loadOpenDrafts } from "./drafts";

export type DraftCardLabel = { id: string; name: string; last4: string };

export type DraftInbox = Awaited<ReturnType<typeof loadDraftInbox>>;

/** Open drafts (F18) with the names of every card and category, archived ones too, to label them and their suggestions. */
export async function loadDraftInbox(supabase: ServerClient, userId: string) {
  const [drafts, cardsResult, categoriesResult] = await Promise.all([
    loadOpenDrafts(supabase, userId),
    supabase.from("cards").select("id,name,last4").eq("user_id", userId),
    supabase.from("categories").select("id,name").eq("user_id", userId),
  ]);
  if (cardsResult.error || categoriesResult.error) throw new Error("No pudimos cargar los movimientos por confirmar.");
  return {
    drafts,
    cards: new Map(((cardsResult.data ?? []) as DraftCardLabel[]).map((card) => [card.id, card])),
    categories: new Map(((categoriesResult.data ?? []) as Array<{ id: string; name: string }>).map((category) => [category.id, category.name])),
  };
}
