import Decimal from "decimal.js";
import type { CardColor } from "@/lib/card-colors";
import type { IsoDate } from "@/lib/domain/dates";
import { installmentProgress, isInstallmentCompleted, type InstallmentRow } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import { statementsToReview } from "@/lib/domain/reconciliation";
import { statementPeriod } from "@/lib/domain/statements";
import type { ServerClient } from "@/lib/supabase/require-user";
import { loadInterestEstimates, type InterestEstimate } from "./interest-estimates";
import { loadStatementBalances, summarizeStatementBalances, type StatementBalancesData } from "./statement-balances";

export type DetailCard = { id: string; name: string; bank: string; last4: string; color: CardColor; cutoff_day: number; payment_day: number; interest_mode: InterestMode; archived_at: string | null };
export type CardStatement = { id: string; period_start: IsoDate; cutoff_date: IsoDate; due_date: IsoDate };
type Purchase = { id: string; merchant: string | null; currency: Currency; installments_count: number };
type RawInstallment = { transaction_id: string; statement_id: string | null; before_tracking: boolean; number: number; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };
export type CardStatementSummary = {
  /** Minimum payment per currency (D33), including the R8 estimate of on-balance cards (D32). */
  cop: Decimal; usd: Decimal; paidAt: string | null; reconciledAt: string | null;
  /** True when the minimum includes estimated interest (D66 "Estimado"). */
  estimated: boolean;
};
export type ActivePurchase = {
  purchase: Purchase;
  progress: ReturnType<typeof installmentProgress>;
  currentInstallment: InstallmentRow;
  /** Cutoff of the last installment of the plan: when the purchase ends. */
  lastCutoffDate: IsoDate | null;
};

/** R8 summary of each statement of a card. */
export function summarizeCardStatements(statements: CardStatement[], balances: Map<string, StatementBalancesData>, estimates: Map<string, InterestEstimate>): Map<string, CardStatementSummary> {
  return new Map(statements.map((statement) => {
    const { summaries, paidAt, reconciledAt } = summarizeStatementBalances(balances.get(statement.id), estimates.get(statement.id));
    const amount = (currency: Currency) => summaries.find((item) => item.currency === currency)?.minimum ?? new Decimal(0);
    return [statement.id, { cop: amount("COP"), usd: amount("USD"), paidAt, reconciledAt, estimated: estimates.has(statement.id) }];
  }));
}

/** Installment purchases still in progress (F3, F10), with the current installment and the pending principal. */
export function activeInstallmentPurchases(purchases: Purchase[], installments: RawInstallment[], statements: CardStatement[], today: IsoDate): ActivePurchase[] {
  return purchases.flatMap((purchase) => {
    const entries = installments.filter((item) => item.transaction_id === purchase.id).map((item): InstallmentRow => {
      const statement = item.before_tracking ? null : statements.find((entry) => entry.id === item.statement_id);
      if (statement === undefined) throw new Error("No pudimos consultar el corte de una cuota.");
      return { number: item.number, cutoffDate: statement?.cutoff_date ?? null, beforeTracking: item.before_tracking, principal: new Decimal(item.principal), interest: new Decimal(item.interest), total: new Decimal(item.total), balanceAfter: new Decimal(item.balance_after), principalCop: new Decimal(item.principal_cop), interestCop: new Decimal(item.interest_cop), totalCop: new Decimal(item.total_cop) };
    });
    if (!entries.length || entries.every((entry) => isInstallmentCompleted(entry, today))) return [];
    const progress = installmentProgress(entries, today);
    const currentInstallment = entries.find((entry) => entry.number === progress.current);
    const lastCutoffDate = entries.reduce<IsoDate | null>((last, entry) => entry.cutoffDate && (!last || entry.cutoffDate > last) ? entry.cutoffDate : last, null);
    return currentInstallment ? [{ purchase, progress, currentInstallment, lastCutoffDate }] : [];
  });
}

export type CardDetail = NonNullable<Awaited<ReturnType<typeof loadCardDetail>>>;

/** A card with its credit (D52), statements by period (F5), statements to close (F15) and installment purchases (F3). Null when it does not exist. */
export async function loadCardDetail(supabase: ServerClient, userId: string, cardId: string, today: IsoDate) {
  const [cardResult, balanceResult, statementResult, purchaseResult] = await Promise.all([
    supabase.from("cards").select("id,name,bank,last4,color,cutoff_day,payment_day,interest_mode,archived_at").eq("id", cardId).eq("user_id", userId).maybeSingle(),
    supabase.from("card_balances").select("available::text,utilization::text,usd_net::text,fx_rate::text,fx_estimated").eq("card_id", cardId).eq("user_id", userId).maybeSingle(),
    supabase.from("statements").select("id,period_start,cutoff_date,due_date").eq("card_id", cardId).eq("user_id", userId).order("cutoff_date"),
    supabase.from("transactions").select("id,merchant,currency,installments_count").eq("card_id", cardId).eq("user_id", userId).eq("type", "purchase").gt("installments_count", 1),
  ]);
  if (cardResult.error || balanceResult.error || statementResult.error || purchaseResult.error) throw new Error("No pudimos consultar la tarjeta.");
  if (!cardResult.data) return null;
  if (!balanceResult.data) throw new Error("No pudimos consultar el cupo de la tarjeta.");
  const card = cardResult.data as DetailCard;
  const balance = balanceResult.data as unknown as { available: string; utilization: string; usd_net?: string; fx_rate?: string | null; fx_estimated?: boolean };
  const statements = (statementResult.data ?? []) as CardStatement[];
  // D32: on-balance statements without registered interest carry the R8 estimate in their minimum payment.
  const [balances, estimates] = await Promise.all([
    loadStatementBalances(supabase, userId, statements.map((item) => item.id)),
    card.interest_mode === "on_balance" ? loadInterestEstimates(supabase, userId, statements) : Promise.resolve(new Map<string, InterestEstimate>()),
  ]);
  const summaries = summarizeCardStatements(statements, balances, estimates);
  // F15: the latest statement already cut asks for its close until it is reconciled (D39).
  const reviews = statementsToReview([{ id: card.id, archived: card.archived_at !== null }], statements.map((item) => ({
    cardId: card.id, cutoffDate: item.cutoff_date, reconciledAt: summaries.get(item.id)!.reconciledAt,
  })), today);
  const current = statementPeriod({ cutoffDay: card.cutoff_day, paymentDay: card.payment_day }, today);
  const open = statements.find((item) => item.period_start <= today && today <= item.cutoff_date);
  const openCutoff = open?.cutoff_date ?? current.cutoffDate;
  const purchases = (purchaseResult.data ?? []) as Purchase[];
  const installmentResult = purchases.length ? await supabase.from("installments").select("transaction_id,statement_id,before_tracking,number,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("user_id", userId).in("transaction_id", purchases.map((purchase) => purchase.id)).order("number") : { data: [], error: null };
  if (installmentResult.error) throw new Error("No pudimos consultar las cuotas.");
  return {
    card,
    balance: { available: balance.available, utilization: balance.utilization, usdNet: balance.usd_net ?? "0", fxRate: balance.fx_rate ?? null, fxEstimated: balance.fx_estimated ?? false },
    statements, summaries, reviews,
    /** The open statement (saved or not yet created) and the dates of the current period (R1). */
    open: open ?? null, openCutoff, openDueDate: open?.due_date ?? current.dueDate,
    upcoming: statements.filter((item) => item.cutoff_date > openCutoff),
    previous: statements.filter((item) => item.cutoff_date < openCutoff).reverse(),
    activePurchases: activeInstallmentPurchases(purchases, (installmentResult.data ?? []) as unknown as RawInstallment[], statements, today),
  };
}
