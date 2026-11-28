import type { IsoDate } from "@/lib/domain/dates";
import type { ServerClient } from "@/lib/supabase/require-user";
import { countOpenDrafts } from "./drafts";
import { loadMonthOverview } from "./months";
import { createSupabaseMonthSource } from "./supabase-months";

export type MonthList = Awaited<ReturnType<typeof loadMonthList>>;

/** Payment months (F6, R7) with the card strip and the number of open drafts (F18). */
export async function loadMonthList(supabase: ServerClient, userId: string, today: IsoDate, historySize: number) {
  const source = createSupabaseMonthSource(supabase, userId);
  const [overview, cards, draftCount] = await Promise.all([
    loadMonthOverview(source, today, { historySize }),
    source.loadCardDetails(),
    countOpenDrafts(supabase, userId),
  ]);
  return {
    overview, cards, draftCount,
    /** Some dollar projection lacks a TRM: only its COP reference is missing (D33). */
    incomplete: [overview.current, ...overview.future, ...overview.history].some((month) => !month.complete),
  };
}
