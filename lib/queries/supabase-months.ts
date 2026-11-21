import Decimal from "decimal.js";
import type { CardColor } from "@/lib/card-colors";
import { monthDateBounds, purchaseMonthSpending, type ProjectionInput } from "@/lib/domain/months";
import { statementPaidAt } from "@/lib/domain/balances";
import { statementReconciledAt } from "@/lib/domain/reconciliation";
import type { AmortizationMethod } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";
import type { MonthReadSource } from "./months";
import { loadPrepaidAmounts, loadPrepaymentBases, netOfPrepayments } from "./prepayments";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawCard = { id: string; name: string; bank: string; last4: string; color: CardColor; archived_at: string | null; cutoff_day: number; payment_day: number; handling_fee: string; interest_mode: InterestMode; purchase_rate_ea: string; amortization_method: AmortizationMethod };
type RawBalance = { card_id: string; used: string; available: string; utilization: string };
type RawStatement = { id: string; card_id: string; period_start: string; cutoff_date: string; due_date: string };
type RawBalanceMark = { statement_id: string; currency: Currency; paid_at: string | null; reconciled_at: string | null };
type RawCurrencyTotal = { statement_id: string; currency: Currency; has_charges: boolean; pending_principal: string };
type RawSubscription = { id: string; name: string; card_id: string; category_id: string | null; amount: string; currency: "COP" | "USD"; frequency: "monthly" | "yearly"; billing_day: number; start_date: string; trial_ends_at: string | null; status: "active" | "paused" | "cancelled"; installments_count: number };
type Movement = ProjectionInput["movements"][number];
type RawMovement = { id: string; statement_id: string; type: Movement["type"]; amount_cop: string; amount: string; currency: "COP" | "USD"; fx_rate: string | null; installments_count: number; source: Movement["source"]; category_id: string | null; subscription_id: string | null; date: string };
type RawInstallment = { id: string; statement_id: string; transaction_id: string; total_cop: string; total: string; principal: string; balance_after: string };
type RawParent = { id: string; category_id: string | null; date: string; rate_ea_applied: string | null; interest_free: boolean; currency: "COP" | "USD"; fx_rate: string | null };

export type MonthCardDetails = {
  id: string; name: string; bank: string; last4: string; color: CardColor; archived: boolean;
  cutoffDay: number; paymentDay: number; handlingFee: Decimal; interestMode?: InterestMode;
  purchaseRateEa?: Decimal; amortizationMethod?: AmortizationMethod;
  used: Decimal; available: Decimal; utilization: Decimal;
};

function mapMovement(row: RawMovement): Movement {
  return {
    id: row.id, statementId: row.statement_id, type: row.type, amountCop: new Decimal(row.amount_cop),
    amount: new Decimal(row.amount), currency: row.currency, fxRate: row.fx_rate === null ? null : new Decimal(row.fx_rate),
    installmentsCount: row.installments_count, source: row.source, categoryId: row.category_id,
    subscriptionId: row.subscription_id, date: row.date,
  };
}

function batches<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

const movementFields = "id,statement_id,type,amount_cop::text,amount::text,currency,fx_rate::text,installments_count,source,category_id,subscription_id,date";

export function createSupabaseMonthSource(client: Client, userId: string): MonthReadSource & {
  loadCardDetails(): Promise<MonthCardDetails[]>;
  loadCategories(): Promise<Array<{ id: string; name: string; icon: string | null }>>;
  loadPurchaseMonthSpending(month: string): Promise<Decimal>;
} {
  let cardDetails: Promise<MonthCardDetails[]> | undefined;
  function loadCardDetails() {
    cardDetails ??= (async () => {
      const [cards, balances] = await Promise.all([
        fetchAllPages((from, to) => client.from("cards").select("id,name,bank,last4,color,archived_at,cutoff_day,payment_day,handling_fee::text,interest_mode,purchase_rate_ea::text,amortization_method").eq("user_id", userId).order("id").range(from, to)),
        fetchAllPages((from, to) => client.from("card_balances").select("card_id,used::text,available::text,utilization::text").eq("user_id", userId).order("card_id").range(from, to)),
      ]);
      const byCard = new Map((balances as unknown as RawBalance[]).map((balance) => [balance.card_id, balance]));
      return (cards as unknown as RawCard[]).map((card) => {
        const balance = byCard.get(card.id);
        if (!balance) throw new Error("No pudimos consultar el cupo de una tarjeta.");
        return {
          id: card.id, name: card.name, bank: card.bank, last4: card.last4, color: card.color,
          archived: card.archived_at !== null, cutoffDay: card.cutoff_day, paymentDay: card.payment_day,
          handlingFee: new Decimal(card.handling_fee), interestMode: card.interest_mode,
          purchaseRateEa: new Decimal(card.purchase_rate_ea), amortizationMethod: card.amortization_method, used: new Decimal(balance.used),
          available: new Decimal(balance.available), utilization: new Decimal(balance.utilization),
        };
      });
    })();
    return cardDetails;
  }

  return {
    loadCardDetails,
    async loadCategories() {
      return fetchAllPages((from, to) => client.from("categories").select("id,name,icon").eq("user_id", userId).order("id").range(from, to));
    },
    async loadPurchaseMonthSpending(month) {
      const { first, last } = monthDateBounds(month);
      const rows = await fetchAllPages((from, to) => client.from("transactions").select("date,type,amount_cop::text").eq("user_id", userId).gte("date", first).lte("date", last).order("id").range(from, to));
      return purchaseMonthSpending((rows as unknown as Array<{ date: string; type: string; amount_cop: string }>).map((row) => ({ date: row.date, type: row.type, amountCop: new Decimal(row.amount_cop) })), month);
    },
    loadCards: loadCardDetails,
    async loadStatements() {
      const [rows, marks, totals] = await Promise.all([
        fetchAllPages((from, to) => client.from("statements").select("id,card_id,period_start,cutoff_date,due_date").eq("user_id", userId).order("id").range(from, to)),
        fetchAllPages((from, to) => client.from("statement_balances").select("statement_id,currency,paid_at,reconciled_at").eq("user_id", userId).order("id").range(from, to)),
        fetchAllPages((from, to) => client.from("statement_currency_totals").select("statement_id,currency,has_charges,pending_principal::text").eq("user_id", userId).order("statement_id").order("currency").range(from, to)),
      ]);
      const paid = new Map<string, Partial<Record<Currency, string | null>>>();
      const reconciled = new Map<string, Partial<Record<Currency, string | null>>>();
      for (const mark of marks as unknown as RawBalanceMark[]) {
        paid.set(mark.statement_id, { ...paid.get(mark.statement_id), [mark.currency]: mark.paid_at });
        reconciled.set(mark.statement_id, { ...reconciled.get(mark.statement_id), [mark.currency]: mark.reconciled_at });
      }
      const currencies = new Map<string, Currency[]>();
      const pending = new Map<string, Partial<Record<Currency, Decimal>>>();
      for (const total of totals as unknown as RawCurrencyTotal[]) {
        if (total.has_charges) currencies.set(total.statement_id, [...currencies.get(total.statement_id) ?? [], total.currency]);
        pending.set(total.statement_id, { ...pending.get(total.statement_id), [total.currency]: new Decimal(total.pending_principal) });
      }
      // D33: a statement is paid once every currency with charges is marked.
      return (rows as unknown as RawStatement[]).map((s) => {
        const paidByCurrency = { COP: paid.get(s.id)?.COP ?? null, USD: paid.get(s.id)?.USD ?? null };
        const reconciledByCurrency = { COP: reconciled.get(s.id)?.COP ?? null, USD: reconciled.get(s.id)?.USD ?? null };
        return {
          id: s.id, cardId: s.card_id, periodStart: s.period_start, cutoffDate: s.cutoff_date, dueDate: s.due_date,
          paidAt: statementPaidAt(paidByCurrency, currencies.get(s.id) ?? []), paidByCurrency, pendingPrincipal: pending.get(s.id) ?? {},
          reconciledByCurrency, reconciledAt: statementReconciledAt(reconciledByCurrency, currencies.get(s.id) ?? []),
        };
      });
    },
    async loadSubscriptions() {
      const rows = await fetchAllPages((from, to) => client.from("subscriptions").select("id,name,card_id,category_id,amount::text,currency,frequency,billing_day,start_date,trial_ends_at,status,installments_count").eq("user_id", userId).order("id").range(from, to));
      return (rows as unknown as RawSubscription[]).map((s) => ({
        id: s.id, name: s.name, cardId: s.card_id, categoryId: s.category_id, amount: new Decimal(s.amount), currency: s.currency,
        frequency: s.frequency, billingDay: s.billing_day, startDate: s.start_date, trialEndsAt: s.trial_ends_at, status: s.status, installmentsCount: s.installments_count,
      }));
    },
    async loadFxRate() {
      const rate = await client.from("fx_rates").select("usd_cop::text").order("date", { ascending: false }).limit(1).maybeSingle();
      if (rate.error) throw new Error("No pudimos consultar la última TRM.");
      const value = (rate.data as unknown as { usd_cop: string } | null)?.usd_cop;
      if (value) return new Decimal(value);
      const fallback = await client.from("transactions").select("fx_rate::text").eq("user_id", userId).eq("currency", "USD").not("fx_rate", "is", null).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (fallback.error) throw new Error("No pudimos consultar la última TRM.");
      const lastRate = (fallback.data as unknown as { fx_rate: string } | null)?.fx_rate;
      return lastRate ? new Decimal(lastRate) : null;
    },
    async loadSubscriptionMovements(today) {
      const rows = await fetchAllPages((from, to) => client.from("transactions").select(movementFields).eq("user_id", userId).not("subscription_id", "is", null).gte("date", today).order("id").range(from, to));
      const movements = (rows as unknown as RawMovement[]).map(mapMovement);
      return movements.length ? netOfPrepayments(movements, await loadPrepaidAmounts(client, userId, movements.map((movement) => movement.id))) : movements;
    },
    async loadCharges(statementIds) {
      if (!statementIds.length) return { movements: [], installments: [] };
      const groups = batches(statementIds);
      const [movements, installments, prepaymentBases] = await Promise.all([
        Promise.all(groups.map((ids) => fetchAllPages((from, to) => client.from("transactions").select(movementFields).eq("user_id", userId).in("statement_id", ids).order("id").range(from, to)))),
        Promise.all(groups.map((ids) => fetchAllPages((from, to) => client.from("installments").select("id,statement_id,transaction_id,total_cop::text,total::text,principal::text,balance_after::text").eq("user_id", userId).in("statement_id", ids).order("id").range(from, to)))),
        loadPrepaymentBases(client, userId, statementIds),
      ]);
      const rows = installments.flat() as unknown as RawInstallment[];
      const loaded = (movements.flat() as unknown as RawMovement[]).map(mapMovement);
      // R9: a single-installment charge counts what is left after its prepayments.
      const singleIds = loaded.filter((movement) => movement.installmentsCount === 1 && movement.type !== "payment" && movement.type !== "refund").map((movement) => movement.id);
      const transactionIds = [...new Set(rows.map((item) => item.transaction_id))];
      const [parents, prepaid] = await Promise.all([Promise.all(batches(transactionIds).map((ids) => fetchAllPages((from, to) => client.from("transactions").select("id,category_id,date,rate_ea_applied::text,interest_free,currency,fx_rate::text").eq("user_id", userId).in("id", ids).order("id").range(from, to)))), singleIds.length ? loadPrepaidAmounts(client, userId, singleIds) : Promise.resolve(new Map())]);
      const purchases = new Map((parents.flat() as unknown as RawParent[]).map((parent) => [parent.id, parent]));
      return {
        movements: netOfPrepayments(loaded, prepaid),
        prepaymentBases,
        installments: rows.map((item) => {
          const purchase = purchases.get(item.transaction_id);
          if (!purchase) throw new Error("No pudimos consultar la categoría de una cuota.");
          return {
            id: item.id, statementId: item.statement_id, categoryId: purchase.category_id, totalCop: new Decimal(item.total_cop),
            total: new Decimal(item.total), currency: purchase.currency,
            interestBasis: {
              principal: new Decimal(item.principal), balanceAfter: new Decimal(item.balance_after), purchaseDate: purchase.date,
              rateEa: purchase.rate_ea_applied === null ? null : new Decimal(purchase.rate_ea_applied), interestFree: purchase.interest_free,
              currency: purchase.currency, fxRate: purchase.fx_rate === null ? null : new Decimal(purchase.fx_rate),
            },
          };
        }),
      };
    },
  };
}
