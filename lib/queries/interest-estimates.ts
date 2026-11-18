import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import { estimateBalanceInterest } from "@/lib/domain/interest";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawInstallment = { statement_id: string; transaction_id: string; principal: string; balance_after: string };
type RawPurchase = { id: string; date: IsoDate; rate_ea_applied: string | null; interest_free: boolean; currency: "COP" | "USD"; fx_rate: string | null };
export type InterestEstimate = ReturnType<typeof estimateBalanceInterest>;

/**
 * R8 estimates for statements of an on-balance card (D32), only where no real interest is registered.
 * Same rule as the month views (`projectStatements`), so card, statement and months add up.
 */
export async function loadInterestEstimates(supabase: Client, userId: string, statements: Array<{ id: string; period_start: IsoDate }>): Promise<Map<string, InterestEstimate>> {
  const estimates = new Map<string, InterestEstimate>();
  if (!statements.length) return estimates;
  const ids = statements.map((statement) => statement.id);
  const [installments, interest] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("installments").select("statement_id,transaction_id,principal::text,balance_after::text").eq("user_id", userId).in("statement_id", ids).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select("statement_id").eq("user_id", userId).eq("type", "interest").in("statement_id", ids).order("id").range(from, to)),
  ]);
  const rows = installments as unknown as RawInstallment[];
  const withRealInterest = new Set((interest as unknown as Array<{ statement_id: string }>).map((row) => row.statement_id));
  const purchaseIds = [...new Set(rows.map((row) => row.transaction_id))];
  const purchases = purchaseIds.length ? await fetchAllPages((from, to) => supabase.from("transactions").select("id,date,rate_ea_applied::text,interest_free,currency,fx_rate::text").eq("user_id", userId).in("id", purchaseIds).order("id").range(from, to)) : [];
  const byId = new Map((purchases as unknown as RawPurchase[]).map((purchase) => [purchase.id, purchase]));
  for (const statement of statements) {
    if (withRealInterest.has(statement.id)) continue;
    const estimate = estimateBalanceInterest(rows.filter((row) => row.statement_id === statement.id).map((row) => {
      const purchase = byId.get(row.transaction_id);
      if (!purchase) throw new Error("No pudimos consultar la compra de una cuota.");
      return {
        principal: new Decimal(row.principal), balanceAfter: new Decimal(row.balance_after), purchaseDate: purchase.date,
        rateEa: purchase.rate_ea_applied === null ? null : new Decimal(purchase.rate_ea_applied), interestFree: purchase.interest_free,
        currency: purchase.currency, fxRate: purchase.fx_rate === null ? null : new Decimal(purchase.fx_rate),
      };
    }), statement.period_start);
    if (estimate.amountCop.gt(0)) estimates.set(statement.id, estimate);
  }
  return estimates;
}
