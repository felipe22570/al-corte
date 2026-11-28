import Decimal from "decimal.js";
import type { CardColor } from "@/lib/card-colors";
import type { IsoDate } from "@/lib/domain/dates";
import { deferralCostSummary } from "@/lib/domain/deferral-cost";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import type { ServerClient } from "@/lib/supabase/require-user";

export type DetailTransaction = { id: string; card_id: string; category_id: string | null; statement_id: string; parent_id: string | null; subscription_id: string | null; type: string; date: IsoDate; merchant: string | null; note: string | null; currency: Currency; amount: string; amount_cop: string; fx_rate: string | null; source: string; paid_statement_id: string | null; payment_kind: string | null; interest_free: boolean; rate_ea_applied: string | null };
export type DetailPrepayment = { id: string; payment_id: string | null; statement_id: string | null; transaction_id: string; amount: string; effect: string; assumed: boolean; bank_balance: string | null; remaining_installments: number | null; effective_date: IsoDate | null };
export type DetailCounterpart = { id: string; merchant: string | null; date: IsoDate; type: string; installments_count: number; statement_id: string };
export type DetailStatement = { id: string; cutoff_date: IsoDate; due_date: IsoDate };
/** One installment of the plan; previous ones (D31) have no statement. */
export type DetailInstallment = { number: number; cutoffDate: IsoDate | null; beforeTracking: boolean; principal: string; interest: string; total: string; balanceAfter: string; principalCop: string; interestCop: string; totalCop: string };
type RawInstallment = { number: number; statement_id: string | null; before_tracking: boolean; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };
type DetailCard = { name: string; last4: string; color: CardColor; cutoff_day: number; interest_mode: InterestMode };

export function detailInstallments(rows: RawInstallment[], statements: Map<string, DetailStatement>): DetailInstallment[] {
  return rows.map((item) => {
    const installmentStatement = item.before_tracking || item.statement_id === null ? null : statements.get(item.statement_id);
    if (installmentStatement === undefined) throw new Error("No pudimos consultar el extracto de una cuota.");
    return { number: item.number, cutoffDate: installmentStatement?.cutoff_date ?? null, beforeTracking: item.before_tracking, principal: item.principal, interest: item.interest, total: item.total, balanceAfter: item.balance_after, principalCop: item.principal_cop, interestCop: item.interest_cop, totalCop: item.total_cop };
  });
}

/** F21 (R11): the cost of deferring with the card rule, including prepayments weighted by days in their period (R9). */
export function transactionDeferralCost(input: {
  transaction: DetailTransaction; card: Pick<DetailCard, "cutoff_day" | "interest_mode">; items: DetailInstallment[];
  prepayments: DetailPrepayment[]; counterparts: Map<string, DetailCounterpart>; statements: Map<string, DetailStatement>; today: IsoDate;
}) {
  const { transaction, card, items, prepayments, counterparts, statements, today } = input;
  if (!(transaction.type === "purchase" || transaction.type === "cash_advance") || items.length <= 1) return null;
  return deferralCostSummary({
    amount: new Decimal(transaction.amount), currency: transaction.currency, fxRate: transaction.fx_rate === null ? null : new Decimal(transaction.fx_rate), purchaseDate: transaction.date,
    rateEa: transaction.rate_ea_applied === null ? null : new Decimal(transaction.rate_ea_applied), interestFree: transaction.interest_free, interestMode: card.interest_mode, cutoffDay: card.cutoff_day, installmentsCount: items.length,
    rows: items.map((item) => ({ cutoffDate: item.cutoffDate, beforeTracking: item.beforeTracking, principal: new Decimal(item.principal), interest: new Decimal(item.interest), balanceAfter: new Decimal(item.balanceAfter) })),
    prepayments: prepayments.flatMap((item) => {
      const payment = item.transaction_id === transaction.id && item.payment_id ? counterparts.get(item.payment_id) : undefined;
      const statement = payment ? statements.get(payment.statement_id) : undefined;
      return payment && statement ? [{ cutoffDate: statement.cutoff_date, date: payment.date, amount: new Decimal(item.amount) }] : [];
    }),
  }, today);
}

export type TransactionDetail = NonNullable<Awaited<ReturnType<typeof loadTransactionDetail>>>;

/** A movement with its card, category, plan (F3), prepayments and plan changes (R9, F16) and cost of deferring (F21). Null when it does not exist. */
export async function loadTransactionDetail(supabase: ServerClient, userId: string, id: string, today: IsoDate) {
  const { data, error } = await supabase.from("transactions").select("id,card_id,category_id,statement_id,parent_id,subscription_id,type,date,merchant,note,currency,amount::text,amount_cop::text,fx_rate::text,source,paid_statement_id,payment_kind,interest_free,rate_ea_applied::text").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw new Error("No pudimos consultar el movimiento.");
  if (!data) return null;
  const transaction = data as unknown as DetailTransaction;
  const [cardResult, categoryResult, installmentResult, statementsResult, childrenResult, prepaymentsResult] = await Promise.all([
    supabase.from("cards").select("name,last4,color,cutoff_day,interest_mode").eq("id", transaction.card_id).eq("user_id", userId).single(),
    transaction.category_id ? supabase.from("categories").select("name,icon").eq("id", transaction.category_id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("installments").select("number,statement_id,before_tracking,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("transaction_id", id).eq("user_id", userId).order("number"),
    supabase.from("statements").select("id,cutoff_date,due_date").eq("card_id", transaction.card_id).eq("user_id", userId),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("parent_id", id).eq("user_id", userId),
    supabase.from("principal_prepayments").select("id,payment_id,statement_id,transaction_id,amount::text,effect,assumed,bank_balance::text,remaining_installments,effective_date").eq("user_id", userId).or(`transaction_id.eq.${id},payment_id.eq.${id}`).order("created_at"),
  ]);
  if (cardResult.error || categoryResult.error || installmentResult.error || statementsResult.error || childrenResult.error || prepaymentsResult.error) throw new Error("No pudimos consultar los detalles del movimiento.");
  const card = cardResult.data as DetailCard;
  const category = categoryResult.data as { name: string; icon: string } | null;
  const statements = new Map(((statementsResult.data ?? []) as DetailStatement[]).map((statement) => [statement.id, statement]));
  const statement = statements.get(transaction.statement_id);
  if (!statement) throw new Error("No pudimos consultar el extracto del movimiento.");
  const items = detailInstallments((installmentResult.data ?? []) as unknown as RawInstallment[], statements);
  // R9: prepayments this movement received, or the ones this payment made.
  const prepayments = (prepaymentsResult.data ?? []) as unknown as DetailPrepayment[];
  const counterpartIds = [...new Set(prepayments.flatMap((item) => item.payment_id === id ? [item.transaction_id] : item.payment_id ? [item.payment_id] : []))];
  const counterpartsResult = counterpartIds.length ? await supabase.from("transactions").select("id,merchant,date,type,installments_count,statement_id").eq("user_id", userId).in("id", counterpartIds) : { data: [], error: null };
  if (counterpartsResult.error) throw new Error("No pudimos consultar los abonos del movimiento.");
  const counterparts = new Map(((counterpartsResult.data ?? []) as DetailCounterpart[]).map((item) => [item.id, item]));
  return {
    transaction, card, category, statement, statements, items, prepayments, counterparts,
    childrenCount: childrenResult.count ?? 0,
    paidStatement: transaction.paid_statement_id ? statements.get(transaction.paid_statement_id) ?? null : null,
    /** F16: the latest plan change of a purchase can be undone when it is an installment change. */
    latestChangeId: transaction.type !== "payment" ? prepayments.at(-1)?.id ?? null : null,
    /** Installments not billed yet, which an installment change can replace (D40). */
    unbilled: items.filter((item) => !item.beforeTracking && item.cutoffDate! >= today).length,
    deferral: transactionDeferralCost({ transaction, card, items, prepayments, counterparts, statements, today }),
    /** Late interest is registered and corrected in the statement close (D39); an advance fee follows its advance. */
    editable: !(transaction.type === "advance_fee" && transaction.parent_id) && transaction.type !== "late_interest",
  };
}
