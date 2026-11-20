import Decimal from "decimal.js";
import { addDays, type IsoDate } from "@/lib/domain/dates";
import type { AmortizationMethod, InstallmentRow } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import { pendingMinimum, type AllocationRule, type PaymentTarget, type PrepaymentTargetType } from "@/lib/domain/payments";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import { statementCutoffFor } from "@/lib/domain/statements";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";
import { loadInterestEstimates } from "./interest-estimates";
import { loadStatementBalances, summarizeStatementBalances } from "./statement-balances";
import { createSupabaseMonthSource } from "./supabase-months";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawStatement = { id: string; card_id: string; period_start: IsoDate; cutoff_date: IsoDate; due_date: IsoDate };
type RawCard = { id: string; name: string; last4: string; cutoff_day: number; interest_mode: InterestMode; amortization_method: AmortizationMethod; payment_allocation_rule: AllocationRule };
type RawTarget = {
  id: string; type: PrepaymentTargetType; date: IsoDate; merchant: string | null; currency: Currency; amount: string; amount_cop: string; fx_rate: string | null;
  installments_count: number; interest_free: boolean; is_international: boolean; rate_ea_applied: string | null; statement_id: string;
};
type RawInstallment = { transaction_id: string; statement_id: string | null; number: number; before_tracking: boolean; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };
type RawPrepayment = { transaction_id: string; amount: string; amount_cop: string };

const targetFields = "id,type,date,merchant,currency,amount::text,amount_cop::text,fx_rate::text,installments_count,interest_free,is_international,rate_ea_applied::text,statement_id";

export type PaymentTargetLabel = { merchant: string | null; type: PrepaymentTargetType; date: IsoDate; installmentsCount: number };
export type PaymentContext = {
  statement: { id: string; cardId: string; cutoffDate: IsoDate; dueDate: IsoDate; nextCutoff: IsoDate };
  card: { id: string; name: string; last4: string; rule: AllocationRule };
  currency: Currency;
  /** R9: pending minimum of the statement in this currency, after payments already registered for it. */
  pending: Decimal;
  minimum: Decimal;
  paidAt: string | null;
  targets: PaymentTarget[];
  labels: Map<string, PaymentTargetLabel>;
  /** D4 TRM for a payment in dollars; null when unknown. */
  fxRate: Decimal | null;
};

function batches<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/**
 * Everything needed to plan a payment of one statement and currency (F14): pending minimum, the card's rule and the card's
 * movements in that currency that may still receive prepayments, with their installments and previous prepayments.
 */
export async function loadPaymentContext(supabase: Client, userId: string, statementId: string, currency: Currency): Promise<PaymentContext | null> {
  const statementResult = await supabase.from("statements").select("id,card_id,period_start,cutoff_date,due_date").eq("id", statementId).eq("user_id", userId).maybeSingle();
  if (statementResult.error) throw new Error("No pudimos consultar el extracto.");
  const statement = statementResult.data as unknown as RawStatement | null;
  if (!statement) return null;
  const [cardResult, cardStatements, payments, multi, balances] = await Promise.all([
    supabase.from("cards").select("id,name,last4,cutoff_day,interest_mode,amortization_method,payment_allocation_rule").eq("id", statement.card_id).eq("user_id", userId).maybeSingle(),
    fetchAllPages((from, to) => supabase.from("statements").select("id,cutoff_date").eq("user_id", userId).eq("card_id", statement.card_id).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select("amount::text").eq("user_id", userId).eq("type", "payment").eq("paid_statement_id", statement.id).eq("currency", currency).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select(targetFields).eq("user_id", userId).eq("card_id", statement.card_id).eq("currency", currency).in("type", ["purchase", "cash_advance"]).gt("installments_count", 1).order("id").range(from, to)),
    loadStatementBalances(supabase, userId, [statement.id]),
  ]);
  if (cardResult.error) throw new Error("No pudimos consultar la tarjeta.");
  const card = cardResult.data as unknown as RawCard | null;
  if (!card) return null;
  const cutoffs = new Map((cardStatements as unknown as Array<{ id: string; cutoff_date: IsoDate }>).map((item) => [item.id, item.cutoff_date]));
  // Single-installment charges can only be prepaid while their statement is open, so only statements after this cutoff matter.
  const laterIds = [...cutoffs].filter(([, cutoff]) => cutoff > statement.cutoff_date).map(([id]) => id);
  const [singles, estimates, fxRate] = await Promise.all([
    Promise.all(batches(laterIds).map((ids) => fetchAllPages((from, to) => supabase.from("transactions").select(targetFields).eq("user_id", userId).eq("currency", currency)
      .in("type", ["purchase", "cash_advance", "advance_fee", "adjustment"]).eq("installments_count", 1).in("statement_id", ids).order("id").range(from, to)))),
    card.interest_mode === "on_balance" ? loadInterestEstimates(supabase, userId, [statement]) : Promise.resolve(new Map()),
    currency === "USD" ? createSupabaseMonthSource(supabase, userId).loadFxRate() : Promise.resolve(null),
  ]);
  const rawTargets = [...(multi as unknown as RawTarget[]), ...(singles.flat() as unknown as RawTarget[])];
  const ids = rawTargets.map((target) => target.id);
  const [installments, prepayments] = await Promise.all([
    Promise.all(batches(ids).map((group) => fetchAllPages((from, to) => supabase.from("installments").select("transaction_id,statement_id,number,before_tracking,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("user_id", userId).in("transaction_id", group).order("id").range(from, to)))),
    Promise.all(batches(ids).map((group) => fetchAllPages((from, to) => supabase.from("principal_prepayments").select("transaction_id,amount::text,amount_cop::text").eq("user_id", userId).in("transaction_id", group).order("id").range(from, to)))),
  ]);
  const rowsByTarget = new Map<string, RawInstallment[]>();
  for (const row of installments.flat() as unknown as RawInstallment[]) rowsByTarget.set(row.transaction_id, [...rowsByTarget.get(row.transaction_id) ?? [], row]);
  const prepaidByTarget = new Map<string, RawPrepayment[]>();
  for (const row of prepayments.flat() as unknown as RawPrepayment[]) prepaidByTarget.set(row.transaction_id, [...prepaidByTarget.get(row.transaction_id) ?? [], row]);

  const targets: PaymentTarget[] = rawTargets.map((raw) => {
    const rate = raw.rate_ea_applied === null ? new Decimal(0) : new Decimal(raw.rate_ea_applied);
    // Same rate rule as buildInstallmentPlan: no interest inside one-installment, interest-free or on-balance plans.
    const monthlyRate = raw.installments_count > 1 && !raw.interest_free && card.interest_mode !== "on_balance" ? monthlyRateFromEA(rate) : new Decimal(0);
    const rows: InstallmentRow[] = (rowsByTarget.get(raw.id) ?? []).sort((a, b) => a.number - b.number).map((row) => ({
      number: row.number, principal: new Decimal(row.principal), interest: new Decimal(row.interest), total: new Decimal(row.total), balanceAfter: new Decimal(row.balance_after),
      cutoffDate: row.statement_id ? cutoffs.get(row.statement_id) ?? null : null, beforeTracking: row.before_tracking,
      principalCop: new Decimal(row.principal_cop), interestCop: new Decimal(row.interest_cop), totalCop: new Decimal(row.total_cop),
    }));
    return {
      id: raw.id, type: raw.type, date: raw.date, currency: raw.currency, installmentsCount: raw.installments_count, interestFree: raw.interest_free,
      isInternational: raw.is_international, statementCutoff: cutoffs.get(raw.statement_id)!,
      terms: { amount: new Decimal(raw.amount), amountCop: new Decimal(raw.amount_cop), currency: raw.currency, fxRate: raw.fx_rate === null ? null : new Decimal(raw.fx_rate), method: card.amortization_method, monthlyRate },
      rows, prepayments: (prepaidByTarget.get(raw.id) ?? []).map((item) => ({ amount: new Decimal(item.amount), amountCop: new Decimal(item.amount_cop) })),
    };
  });
  const summary = summarizeStatementBalances(balances.get(statement.id), estimates.get(statement.id)).summaries.find((item) => item.currency === currency);
  const minimum = summary?.minimum ?? new Decimal(0);
  const paid = (payments as unknown as Array<{ amount: string }>).reduce((total, payment) => total.plus(payment.amount), new Decimal(0));
  return {
    statement: { id: statement.id, cardId: statement.card_id, cutoffDate: statement.cutoff_date, dueDate: statement.due_date, nextCutoff: statementCutoffFor(card.cutoff_day, addDays(statement.cutoff_date, 1)) },
    card: { id: card.id, name: card.name, last4: card.last4, rule: card.payment_allocation_rule },
    currency, minimum, paidAt: summary?.paidAt ?? null,
    pending: pendingMinimum({ calculated: minimum, bankMinimum: summary?.realMinimum ?? null, paid }),
    targets, labels: new Map(rawTargets.map((raw) => [raw.id, { merchant: raw.merchant, type: raw.type, date: raw.date, installmentsCount: raw.installments_count }])),
    fxRate,
  };
}
