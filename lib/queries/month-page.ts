import type { IsoDate } from "@/lib/domain/dates";
import { currencyPaidAt, monthBreakdown, monthComparison, type PaymentMonthSummary } from "@/lib/domain/months";
import type { ServerClient } from "@/lib/supabase/require-user";
import { loadMonthDetail } from "./months";
import { loadPayInFullSavings, type SavingsRequest } from "./pay-in-full-savings";
import { createSupabaseMonthSource } from "./supabase-months";

/** F21: cut real statements of the month with debt still unpaid in some currency (D54). */
export function monthSavingsRequests(month: PaymentMonthSummary, today: IsoDate): SavingsRequest[] {
  return month.cards.flatMap((group) => group.statements.flatMap(({ statement }) => {
    if (statement.origin !== "real" || !statement.id || !statement.debt || statement.cutoffDate >= today) return [];
    const currencies = (["COP", "USD"] as const).filter((currency) => statement.debt![currency].gt(0) && !currencyPaidAt(statement, currency));
    return currencies.length ? [{ id: statement.id, cardId: statement.cardId, cutoffDate: statement.cutoffDate, currencies: [...currencies] }] : [];
  }));
}

export type MonthPage = NonNullable<Awaited<ReturnType<typeof loadMonthPage>>>;

/**
 * A payment month (F9): its detail (R7), cards, categories, purchases of the calendar month (D5), pay-in-full savings (F21),
 * breakdowns per currency (D28, D33) and the comparison with the previous month (D29). Null outside the available months.
 */
export async function loadMonthPage(supabase: ServerClient, userId: string, today: IsoDate, requested: string) {
  const source = createSupabaseMonthSource(supabase, userId);
  const detail = await loadMonthDetail(source, today, requested);
  if (!detail) return null;
  const [cards, categories, purchases] = await Promise.all([
    source.loadCardDetails(), source.loadCategories(), source.loadPurchaseMonthSpending(requested),
  ]);
  const savings = await loadPayInFullSavings(supabase, userId, monthSavingsRequests(detail.month, today), today);
  return {
    ...detail, cards, categories, purchases, savings,
    breakdown: monthBreakdown(detail.month.statements),
    // D33: dollar charges are broken down apart and never added to the peso total.
    usdBreakdown: detail.month.totalUsd.isZero() ? null : monthBreakdown(detail.month.statements, "USD"),
    comparison: monthComparison(detail.month, detail.previous),
  };
}
