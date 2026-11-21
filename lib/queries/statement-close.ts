import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import type { AmortizationMethod, InstallmentRow } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import type { PaymentTarget } from "@/lib/domain/payments";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import { balanceAfterStatement } from "@/lib/domain/reconciliation";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";
import { loadInterestEstimates } from "./interest-estimates";
import { loadStatementBalances, summarizeStatementBalances } from "./statement-balances";
import { createSupabaseMonthSource } from "./supabase-months";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawStatement = { id: string; card_id: string; period_start: IsoDate; cutoff_date: IsoDate; due_date: IsoDate };
type RawCard = { id: string; name: string; last4: string; cutoff_day: number; interest_mode: InterestMode; amortization_method: AmortizationMethod };
type RawPurchase = {
  id: string; type: "purchase" | "cash_advance"; date: IsoDate; merchant: string | null; currency: Currency; amount: string; amount_cop: string; fx_rate: string | null;
  installments_count: number; interest_free: boolean; is_international: boolean; rate_ea_applied: string | null; statement_id: string;
};
type RawRow = { transaction_id: string; statement_id: string | null; number: number; before_tracking: boolean; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };
type RawSnapshotRow = { number: number; cutoff_date: IsoDate; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };
type RawPrepayment = { transaction_id: string; payment_id: string | null; statement_id: string | null; amount: string; amount_cop: string; bank_balance: string | null; replaced_from_number: number | null; replaced_installments: RawSnapshotRow[] | null };

export type ClosePurchase = {
  id: string; merchant: string | null; type: "purchase" | "cash_advance"; date: IsoDate; installmentsCount: number;
  /** Balance after the statement as Al Corte computes it, without this statement's correction (D39). */
  calculated: Decimal;
  /** Bank balance already entered for this statement, if any. */
  bankBalance: Decimal | null;
  /** The movement as it would be without this statement's correction: the base for a new one. */
  target: PaymentTarget;
};
export type CloseContext = {
  statement: { id: string; cardId: string; cutoffDate: IsoDate; dueDate: IsoDate };
  card: { id: string; cutoffDay: number };
  currency: Currency;
  calculated: { minimum: Decimal; debt: Decimal; interest: Decimal; estimated: boolean };
  bank: { minimum: Decimal | null; debt: Decimal | null; rateEa: Decimal | null; reconciledAt: string | null; interest: Decimal | null; lateInterest: Decimal | null };
  purchases: ClosePurchase[];
  /** D4 TRM for interest charges in dollars; null when unknown. */
  fxRate: Decimal | null;
};

const row = (raw: Omit<RawRow, "transaction_id" | "statement_id" | "before_tracking">, cutoffDate: IsoDate | null, beforeTracking: boolean): InstallmentRow => ({
  number: raw.number, principal: new Decimal(raw.principal), interest: new Decimal(raw.interest), total: new Decimal(raw.total), balanceAfter: new Decimal(raw.balance_after),
  cutoffDate, beforeTracking, principalCop: new Decimal(raw.principal_cop), interestCop: new Decimal(raw.interest_cop), totalCop: new Decimal(raw.total_cop),
});

/**
 * Everything the monthly close of one statement and currency needs (F15, D39): calculation and bank values, real interest,
 * and the purchases in installments of the statement's debt with their balance after it.
 */
export async function loadCloseContext(supabase: Client, userId: string, statementId: string, currency: Currency): Promise<CloseContext | null> {
  const statementResult = await supabase.from("statements").select("id,card_id,period_start,cutoff_date,due_date").eq("id", statementId).eq("user_id", userId).maybeSingle();
  if (statementResult.error) throw new Error("No pudimos consultar el extracto.");
  const statement = statementResult.data as unknown as RawStatement | null;
  if (!statement) return null;
  const [cardResult, cardStatements, interestMovements, purchases, balances, mark] = await Promise.all([
    supabase.from("cards").select("id,name,last4,cutoff_day,interest_mode,amortization_method").eq("id", statement.card_id).eq("user_id", userId).maybeSingle(),
    fetchAllPages((from, to) => supabase.from("statements").select("id,cutoff_date").eq("user_id", userId).eq("card_id", statement.card_id).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select("type,amount::text").eq("user_id", userId).eq("statement_id", statement.id).eq("currency", currency).in("type", ["interest", "late_interest"]).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select("id,type,date,merchant,currency,amount::text,amount_cop::text,fx_rate::text,installments_count,interest_free,is_international,rate_ea_applied::text,statement_id").eq("user_id", userId).eq("card_id", statement.card_id).eq("currency", currency).in("type", ["purchase", "cash_advance"]).gt("installments_count", 1).order("date").order("id").range(from, to)),
    loadStatementBalances(supabase, userId, [statement.id]),
    supabase.from("statement_balances").select("rate_ea::text,reconciled_at").eq("user_id", userId).eq("statement_id", statement.id).eq("currency", currency).maybeSingle(),
  ]);
  if (cardResult.error || mark.error) throw new Error("No pudimos consultar el extracto.");
  const card = cardResult.data as unknown as RawCard | null;
  if (!card) return null;
  const cutoffs = new Map((cardStatements as unknown as Array<{ id: string; cutoff_date: IsoDate }>).map((item) => [item.id, item.cutoff_date]));
  // The statement's debt: purchases and advances in installments billed up to its cutoff (R8).
  const debt = (purchases as unknown as RawPurchase[]).filter((purchase) => cutoffs.get(purchase.statement_id)! <= statement.cutoff_date);
  const ids = debt.map((purchase) => purchase.id);
  const [rows, prepayments, estimates, fxRate] = await Promise.all([
    ids.length ? fetchAllPages((from, to) => supabase.from("installments").select("transaction_id,statement_id,number,before_tracking,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("user_id", userId).in("transaction_id", ids).order("number").range(from, to)) : Promise.resolve([]),
    ids.length ? fetchAllPages((from, to) => supabase.from("principal_prepayments").select("transaction_id,payment_id,statement_id,amount::text,amount_cop::text,bank_balance::text,replaced_from_number,replaced_installments").eq("user_id", userId).in("transaction_id", ids).order("created_at").range(from, to)) : Promise.resolve([]),
    card.interest_mode === "on_balance" ? loadInterestEstimates(supabase, userId, [statement]) : Promise.resolve(new Map()),
    currency === "USD" ? createSupabaseMonthSource(supabase, userId).loadFxRate() : Promise.resolve(null),
  ]);
  const rawPrepayments = prepayments as unknown as RawPrepayment[];
  const paymentIds = [...new Set(rawPrepayments.flatMap((item) => item.payment_id ? [item.payment_id] : []))];
  const paymentDates = new Map<string, IsoDate>();
  if (paymentIds.length) {
    const result = await supabase.from("transactions").select("id,date").eq("user_id", userId).in("id", paymentIds);
    if (result.error) throw new Error("No pudimos consultar los pagos.");
    for (const payment of (result.data ?? []) as Array<{ id: string; date: IsoDate }>) paymentDates.set(payment.id, payment.date);
  }

  const closePurchases = debt.flatMap((raw): ClosePurchase[] => {
    const own = rawPrepayments.filter((item) => item.transaction_id === raw.id);
    const correction = own.find((item) => item.statement_id === statement.id);
    let installments = (rows as unknown as RawRow[]).filter((item) => item.transaction_id === raw.id)
      .map((item) => row(item, item.statement_id ? cutoffs.get(item.statement_id) ?? null : null, item.before_tracking));
    // Without this statement's correction: its replaced rows come back, as the database does before applying a new one.
    if (correction) installments = installments.filter((item) => item.number < correction.replaced_from_number!).concat((correction.replaced_installments ?? []).map((item) => row(item, item.cutoff_date, false)));
    const rate = raw.rate_ea_applied === null ? new Decimal(0) : new Decimal(raw.rate_ea_applied);
    const target: PaymentTarget = {
      id: raw.id, type: raw.type, date: raw.date, currency: raw.currency, installmentsCount: raw.installments_count, interestFree: raw.interest_free, isInternational: raw.is_international,
      statementCutoff: cutoffs.get(raw.statement_id)!,
      terms: { amount: new Decimal(raw.amount), amountCop: new Decimal(raw.amount_cop), currency: raw.currency, fxRate: raw.fx_rate === null ? null : new Decimal(raw.fx_rate), method: card.amortization_method,
        monthlyRate: !raw.interest_free && card.interest_mode !== "on_balance" ? monthlyRateFromEA(rate) : new Decimal(0) },
      rows: installments,
      prepayments: own.filter((item) => item !== correction).map((item) => ({
        amount: new Decimal(item.amount), amountCop: new Decimal(item.amount_cop), date: item.payment_id ? paymentDates.get(item.payment_id) : cutoffs.get(item.statement_id!),
      })),
    };
    const calculated = balanceAfterStatement(target, statement.cutoff_date);
    // Purchases already paid off by the cutoff have nothing to check, unless a correction was entered.
    if (!calculated.gt(0) && !correction) return [];
    return [{ id: raw.id, merchant: raw.merchant, type: raw.type, date: raw.date, installmentsCount: raw.installments_count, calculated,
      bankBalance: correction?.bank_balance ? new Decimal(correction.bank_balance) : null, target }];
  });

  const totals = balances.get(statement.id)?.totals[currency];
  const estimate = estimates.get(statement.id);
  const summary = summarizeStatementBalances(balances.get(statement.id), estimate).summaries.find((item) => item.currency === currency);
  const markData = mark.data as unknown as { rate_ea: string | null; reconciled_at: string | null } | null;
  const interest = (interestMovements as unknown as Array<{ type: string; amount: string }>);
  const sumOf = (type: string) => {
    const items = interest.filter((item) => item.type === type);
    return items.length ? items.reduce((sum, item) => sum.plus(item.amount), new Decimal(0)) : null;
  };
  return {
    statement: { id: statement.id, cardId: statement.card_id, cutoffDate: statement.cutoff_date, dueDate: statement.due_date },
    card: { id: card.id, cutoffDay: card.cutoff_day },
    currency,
    calculated: {
      minimum: summary?.minimum ?? new Decimal(0), debt: summary?.debt ?? new Decimal(0),
      interest: new Decimal(totals?.interest ?? 0).plus(summary?.estimatedInterest ?? 0), estimated: !!summary?.estimatedInterest.gt(0),
    },
    bank: {
      minimum: summary?.realMinimum ?? null, debt: summary?.realTotal ?? null, rateEa: markData?.rate_ea ? new Decimal(markData.rate_ea) : null,
      reconciledAt: markData?.reconciled_at ?? null, interest: sumOf("interest"), lateInterest: sumOf("late_interest"),
    },
    purchases: closePurchases,
    fxRate,
  };
}
