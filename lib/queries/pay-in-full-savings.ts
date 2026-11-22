import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import { payInFullSavings, type DeferralPurchase } from "@/lib/domain/deferral-cost";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import { statementCutoffFor } from "@/lib/domain/statements";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawCard = { id: string; cutoff_day: number; interest_mode: InterestMode };
type RawStatement = { id: string; card_id: string; cutoff_date: IsoDate };
type RawInstallment = { transaction_id: string; statement_id: string; before_tracking: boolean; principal: string; interest: string; balance_after: string };
type RawPurchase = { id: string; card_id: string; date: IsoDate; rate_ea_applied: string | null; interest_free: boolean; currency: Currency; fx_rate: string | null; installments_count: number };
export type SavingsRequest = { id: string; cardId: string; cutoffDate: IsoDate; currencies: Currency[] };
export type Savings = Map<string, Partial<Record<Currency, Decimal>>>;

function batches<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/**
 * Interest avoided by paying the total debt of each statement and currency (R11, D54). Reads only the installments of
 * statements after the period open today, which are the ones the payment avoids.
 */
export async function loadPayInFullSavings(supabase: Client, userId: string, requests: SavingsRequest[], today: IsoDate): Promise<Savings> {
  const savings: Savings = new Map();
  if (!requests.length) return savings;
  const cardIds = [...new Set(requests.map((request) => request.cardId))];
  const cardsResult = await supabase.from("cards").select("id,cutoff_day,interest_mode").eq("user_id", userId).in("id", cardIds);
  if (cardsResult.error) throw new Error("No pudimos consultar las tarjetas del ahorro estimado.");
  const cards = new Map(((cardsResult.data ?? []) as unknown as RawCard[]).map((card) => [card.id, card]));
  const openCutoffs = new Map([...cards.values()].map((card) => [card.id, statementCutoffFor(card.cutoff_day, today)]));
  const earliest = [...openCutoffs.values()].sort()[0];
  const statements = earliest ? (await fetchAllPages((from, to) => supabase.from("statements").select("id,card_id,cutoff_date").eq("user_id", userId).in("card_id", cardIds).gt("cutoff_date", earliest).order("id").range(from, to)) as unknown as RawStatement[])
    .filter((statement) => statement.cutoff_date > openCutoffs.get(statement.card_id)!) : [];
  const cutoffs = new Map(statements.map((statement) => [statement.id, statement.cutoff_date]));
  const installments = (await Promise.all(batches([...cutoffs.keys()]).map((ids) => fetchAllPages((from, to) =>
    supabase.from("installments").select("transaction_id,statement_id,before_tracking,principal::text,interest::text,balance_after::text").eq("user_id", userId).in("statement_id", ids).order("id").range(from, to))))).flat() as unknown as RawInstallment[];
  const purchaseIds = [...new Set(installments.map((row) => row.transaction_id))];
  const purchases = (await Promise.all(batches(purchaseIds).map((ids) => fetchAllPages((from, to) =>
    supabase.from("transactions").select("id,card_id,date,rate_ea_applied::text,interest_free,currency,fx_rate::text,installments_count").eq("user_id", userId).in("id", ids).order("id").range(from, to))))).flat() as unknown as RawPurchase[];

  const byCard = new Map<string, DeferralPurchase[]>();
  for (const purchase of purchases) {
    const card = cards.get(purchase.card_id)!;
    const rows = installments.filter((row) => row.transaction_id === purchase.id).map((row) => ({
      cutoffDate: cutoffs.get(row.statement_id)!, beforeTracking: row.before_tracking, principal: new Decimal(row.principal), interest: new Decimal(row.interest), balanceAfter: new Decimal(row.balance_after),
    }));
    byCard.set(purchase.card_id, [...byCard.get(purchase.card_id) ?? [], {
      amount: new Decimal(0), currency: purchase.currency, fxRate: purchase.fx_rate === null ? null : new Decimal(purchase.fx_rate), purchaseDate: purchase.date,
      rateEa: purchase.rate_ea_applied === null ? null : new Decimal(purchase.rate_ea_applied), interestFree: purchase.interest_free,
      interestMode: card.interest_mode, cutoffDay: card.cutoff_day, installmentsCount: purchase.installments_count, rows,
    }]);
  }
  for (const request of requests) {
    const result: Partial<Record<Currency, Decimal>> = {};
    for (const currency of request.currencies) result[currency] = payInFullSavings(byCard.get(request.cardId) ?? [], { currency, statementCutoff: request.cutoffDate, today });
    savings.set(request.id, result);
  }
  return savings;
}
