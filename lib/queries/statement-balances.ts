import Decimal from "decimal.js";
import { statementPaidAt } from "@/lib/domain/balances";
import type { Currency } from "@/lib/domain/money";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";
import type { InterestEstimate } from "./interest-estimates";

type Client = Awaited<ReturnType<typeof createClient>>;
export const STATEMENT_CONCEPTS = ["single_purchases", "installments", "subscriptions", "cash_advances", "interest", "handling_fees", "insurance", "adjustments", "refunds", "payments"] as const;
export type StatementConceptKey = typeof STATEMENT_CONCEPTS[number];
/** One row of statement_currency_totals: amounts in the original currency (D33), as text. */
export type CurrencyTotalsRow = { statement_id: string; currency: Currency; has_charges: boolean; total_calculated: string; total_cop: string; pending_principal: string; total_debt: string } & Record<StatementConceptKey, string>;
export type BalanceMarkRow = { statement_id: string; currency: Currency; real_minimum: string | null; real_total: string | null; paid_at: string | null };
export type StatementBalancesData = { totals: Partial<Record<Currency, CurrencyTotalsRow>>; marks: Partial<Record<Currency, BalanceMarkRow>> };
export type CurrencySummary = {
  currency: Currency; hasCharges: boolean;
  /** R8: minimum payment = R5 total in the currency, including the on-balance interest estimate. */
  minimum: Decimal;
  /** R8: minimum plus principal still to be billed. */
  debt: Decimal;
  /** COP reference for dollar balances (D33). */
  equivalentCop: Decimal;
  estimatedInterest: Decimal;
  realMinimum: Decimal | null; realTotal: Decimal | null; paidAt: string | null;
};

const totalsFields = `statement_id,currency,has_charges,${STATEMENT_CONCEPTS.map((concept) => `${concept}::text`).join(",")},total_calculated::text,total_cop::text,pending_principal::text,total_debt::text`;

/** Totals and bank values per statement and currency (D33), shared by the card and statement pages. */
export async function loadStatementBalances(supabase: Client, userId: string, statementIds: string[]): Promise<Map<string, StatementBalancesData>> {
  const result = new Map<string, StatementBalancesData>(statementIds.map((id) => [id, { totals: {}, marks: {} }]));
  if (!statementIds.length) return result;
  const [totals, marks] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("statement_currency_totals").select(totalsFields).eq("user_id", userId).in("statement_id", statementIds).order("statement_id").order("currency").range(from, to)),
    fetchAllPages((from, to) => supabase.from("statement_balances").select("statement_id,currency,real_minimum::text,real_total::text,paid_at").eq("user_id", userId).in("statement_id", statementIds).order("id").range(from, to)),
  ]);
  for (const row of totals as unknown as CurrencyTotalsRow[]) result.get(row.statement_id)!.totals[row.currency] = row;
  for (const row of marks as unknown as BalanceMarkRow[]) result.get(row.statement_id)!.marks[row.currency] = row;
  return result;
}

/**
 * Per-currency summary of a statement. Pesos always appear; dollars only with charges or pending principal.
 * The statement is paid once every currency with charges is marked (D33).
 */
export function summarizeStatementBalances(data: StatementBalancesData | undefined, estimate?: InterestEstimate) {
  const currencies: Currency[] = (["COP", "USD"] as const).filter((currency) => currency === "COP" || data?.totals[currency] || estimate?.byCurrency[currency].gt(0));
  const summaries = currencies.map((currency): CurrencySummary => {
    const totals = data?.totals[currency];
    const mark = data?.marks[currency];
    const estimatedInterest = estimate?.byCurrency[currency] ?? new Decimal(0);
    return {
      currency, hasCharges: !!totals?.has_charges || estimatedInterest.gt(0),
      minimum: new Decimal(totals?.total_calculated ?? 0).plus(estimatedInterest),
      debt: new Decimal(totals?.total_debt ?? 0).plus(estimatedInterest),
      equivalentCop: new Decimal(totals?.total_cop ?? 0).plus(estimate?.copByCurrency[currency] ?? 0),
      estimatedInterest,
      realMinimum: mark?.real_minimum ? new Decimal(mark.real_minimum) : null,
      realTotal: mark?.real_total ? new Decimal(mark.real_total) : null,
      paidAt: mark?.paid_at ?? null,
    };
  });
  const charged = summaries.filter((summary) => summary.hasCharges).map((summary) => summary.currency);
  const paidAt = statementPaidAt(Object.fromEntries(summaries.map((summary) => [summary.currency, summary.paidAt])), charged);
  return { summaries, paidAt };
}
