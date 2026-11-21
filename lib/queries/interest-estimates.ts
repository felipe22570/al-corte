import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import { estimateBalanceInterest } from "@/lib/domain/interest";
import { prepaymentInterestWeight } from "@/lib/domain/payments";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";
import { loadPrepaymentBases } from "./prepayments";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawInstallment = { statement_id: string; transaction_id: string; principal: string; balance_after: string };
type RawKnown = { statement_id: string; currency: "COP" | "USD" };
type RawPurchase = { id: string; date: IsoDate; rate_ea_applied: string | null; interest_free: boolean; currency: "COP" | "USD"; fx_rate: string | null };
export type InterestEstimate = ReturnType<typeof estimateBalanceInterest>;

/**
 * R8 estimates for statements of an on-balance card (D32), only where no real interest is registered.
 * Same rule as the month views (`projectStatements`), so card, statement and months add up. A prepayment made during the
 * period adds its amount weighted by the days before it (R9). A currency with real interest or reconciled with the bank
 * (D39) has no estimate.
 */
export async function loadInterestEstimates(supabase: Client, userId: string, statements: Array<{ id: string; period_start: IsoDate; cutoff_date: IsoDate }>): Promise<Map<string, InterestEstimate>> {
  const estimates = new Map<string, InterestEstimate>();
  if (!statements.length) return estimates;
  const ids = statements.map((statement) => statement.id);
  const [installments, interest, reconciled, prepayments] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("installments").select("statement_id,transaction_id,principal::text,balance_after::text").eq("user_id", userId).in("statement_id", ids).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select("statement_id,currency").eq("user_id", userId).in("type", ["interest", "late_interest"]).in("statement_id", ids).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("statement_balances").select("statement_id,currency").eq("user_id", userId).not("reconciled_at", "is", null).in("statement_id", ids).order("id").range(from, to)),
    loadPrepaymentBases(supabase, userId, ids),
  ]);
  const rows = installments as unknown as RawInstallment[];
  const known = new Set([...(interest as unknown as RawKnown[]), ...(reconciled as unknown as RawKnown[])].map((row) => `${row.statement_id}:${row.currency}`));
  const purchaseIds = [...new Set(rows.map((row) => row.transaction_id))];
  const purchases = purchaseIds.length ? await fetchAllPages((from, to) => supabase.from("transactions").select("id,date,rate_ea_applied::text,interest_free,currency,fx_rate::text").eq("user_id", userId).in("id", purchaseIds).order("id").range(from, to)) : [];
  const byId = new Map((purchases as unknown as RawPurchase[]).map((purchase) => [purchase.id, purchase]));
  for (const statement of statements) {
    const estimate = estimateBalanceInterest(rows.filter((row) => row.statement_id === statement.id).map((row) => {
      const purchase = byId.get(row.transaction_id);
      if (!purchase) throw new Error("No pudimos consultar la compra de una cuota.");
      return {
        principal: new Decimal(row.principal), balanceAfter: new Decimal(row.balance_after), purchaseDate: purchase.date,
        rateEa: purchase.rate_ea_applied === null ? null : new Decimal(purchase.rate_ea_applied), interestFree: purchase.interest_free,
        currency: purchase.currency, fxRate: purchase.fx_rate === null ? null : new Decimal(purchase.fx_rate),
      };
    }).concat(prepayments.filter((item) => item.statementId === statement.id)
      .map((item) => ({ ...item.basis, weight: prepaymentInterestWeight(statement.period_start, statement.cutoff_date, item.date) }))), statement.period_start);
    for (const currency of ["COP", "USD"] as const) {
      if (!known.has(`${statement.id}:${currency}`)) continue;
      estimate.amountCop = estimate.amountCop.minus(estimate.copByCurrency[currency]);
      estimate.byCurrency[currency] = new Decimal(0);
      estimate.copByCurrency[currency] = new Decimal(0);
    }
    if (estimate.byCurrency.COP.gt(0) || estimate.byCurrency.USD.gt(0)) estimates.set(statement.id, estimate);
  }
  return estimates;
}
