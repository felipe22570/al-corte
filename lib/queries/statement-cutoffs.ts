import { addDays, type IsoDate } from "@/lib/domain/dates";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * Cutoffs that already have a statement, per card, from roughly two months back.
 * The transaction form uses them to warn when installment k would be alone in its statement (F10).
 */
export async function loadRecentStatementCutoffs(supabase: Client, userId: string, today: IsoDate): Promise<Record<string, IsoDate[]>> {
  const { data, error } = await supabase.from("statements").select("card_id,cutoff_date").eq("user_id", userId).gte("cutoff_date", addDays(today, -70));
  if (error) throw new Error("No pudimos consultar los extractos de tus tarjetas.");
  const cutoffs: Record<string, IsoDate[]> = {};
  for (const row of (data ?? []) as Array<{ card_id: string; cutoff_date: IsoDate }>) (cutoffs[row.card_id] ??= []).push(row.cutoff_date);
  return cutoffs;
}
