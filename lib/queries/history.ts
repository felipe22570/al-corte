import { monthDateBounds } from "@/lib/domain/months";
import { filterHistoryRows } from "@/lib/history-filtering";
import type { HistoryCard, HistoryCategory, HistoryRow } from "@/lib/history-types";
import { fetchAllPages } from "@/lib/paginate";
import type { ServerClient } from "@/lib/supabase/require-user";
import type { HistoryFilters } from "@/lib/validation/history-filters";

export const HISTORY_PAGE_SIZE = 100;

/** A page of the filtered rows; a page beyond the last shows the last one. */
export function historyPage<T>(rows: T[], requested: number, pageSize = HISTORY_PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const page = Math.min(requested, pageCount);
  return { page, pageCount, shown: rows.slice((page - 1) * pageSize, page * pageSize) };
}

export type History = Awaited<ReturnType<typeof loadHistory>>;

/**
 * Movements of a purchase month (F7, D5) with the card and category filters applied in the query and the type and text
 * filters in memory, plus every card and category (archived ones too) to label them.
 */
export async function loadHistory(supabase: ServerClient, userId: string, filters: HistoryFilters, pageSize = HISTORY_PAGE_SIZE) {
  const { first, last } = monthDateBounds(filters.mes);
  const [cardRows, categoryRows, transactionRows] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("cards").select("id,name,last4,color").eq("user_id", userId).order("name").order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("categories").select("id,name,icon").eq("user_id", userId).order("name").order("id").range(from, to)),
    fetchAllPages((from, to) => {
      let query = supabase.from("transactions").select("id,date,merchant,note,type,amount::text,amount_cop::text,currency,card_id,category_id,installments_count").eq("user_id", userId).gte("date", first).lte("date", last);
      if (filters.tarjeta) query = query.eq("card_id", filters.tarjeta);
      if (filters.categoria) query = query.eq("category_id", filters.categoria);
      return query.order("date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    }),
  ]);
  const filtered = filterHistoryRows(transactionRows as unknown as HistoryRow[], filters);
  return {
    cards: cardRows as HistoryCard[],
    categories: categoryRows as HistoryCategory[],
    filtered,
    ...historyPage(filtered, filters.pagina, pageSize),
    hasFilters: !!(filters.tarjeta || filters.categoria || filters.tipo || filters.q),
  };
}
