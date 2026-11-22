import type { IsoDate } from "@/lib/domain/dates";
import { latestByMerchant, merchantHistorySince, type MerchantHistoryRow, type SuggestibleType } from "@/lib/domain/merchant-suggestions";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawRow = {
  id: string; merchant: string; card_id: string; date: IsoDate; created_at: string; type: SuggestibleType; category_id: string | null;
  installments_count: number; original_installments_count: number | null; currency: "COP" | "USD"; is_international: boolean; interest_free: boolean;
};

/** Upper bound on rows read; a year of a personal card history stays well below it. */
const MAX_ROWS = 3000;

/**
 * Purchases and advances of the last twelve months on active cards, reduced on the server
 * to the latest one per merchant and card, so the form never receives the full history (R11, D53).
 */
export async function loadMerchantHistory(supabase: Client, userId: string, today: IsoDate): Promise<MerchantHistoryRow[]> {
  const { data, error } = await supabase.from("transactions")
    .select("id,merchant,card_id,date,created_at,type,category_id,installments_count,original_installments_count,currency,is_international,interest_free,cards!transactions_card_id_fkey!inner(archived_at)")
    .eq("user_id", userId).in("type", ["purchase", "cash_advance"]).not("merchant", "is", null).is("cards.archived_at", null)
    .gte("date", merchantHistorySince(today)).lte("date", today)
    .order("date", { ascending: false }).order("created_at", { ascending: false }).limit(MAX_ROWS);
  if (error) throw new Error("No pudimos consultar tus comercios recientes.");
  return latestByMerchant(((data ?? []) as unknown as RawRow[]).map((row) => ({
    id: row.id, merchant: row.merchant, cardId: row.card_id, date: row.date, createdAt: row.created_at, type: row.type, categoryId: row.category_id,
    installmentsCount: row.original_installments_count ?? row.installments_count, currency: row.currency, isInternational: row.is_international, interestFree: row.interest_free,
  })));
}
