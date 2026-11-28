import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import { buildInstallmentPlan, type AmortizationMethod } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import { toCop } from "@/lib/domain/money";
import { subscriptionTotals } from "@/lib/domain/subscriptions";
import type { SubscriptionCard, SubscriptionCategory, SubscriptionRecord } from "@/lib/subscription-types";
import type { ServerClient } from "@/lib/supabase/require-user";
import { loadLatestFxRate } from "./transaction-form";

type RawSubscription = { id: string; name: string; card_id: string; category_id: string | null; amount: string; currency: "COP" | "USD"; frequency: "monthly" | "yearly"; billing_day: number; start_date: IsoDate; trial_ends_at: IsoDate | null; status: "active" | "paused" | "cancelled"; installments_count: number };
type RawCard = { id: string; name: string; last4: string; color: SubscriptionCard["color"]; archived_at: string | null; usd_default_installments: number; cutoff_day: number; purchase_rate_ea: string; amortization_method: AmortizationMethod; interest_mode: InterestMode };
export type SubscriptionListCard = SubscriptionCard & { archived_at: string | null };
/** A charge registered for a subscription, newest first. */
export type SubscriptionChargeRow = { id: string; subscription_id: string; date: IsoDate; amount: string; currency: "COP" | "USD" };

/** F4: monthly and yearly cost of active subscriptions in COP, dollars at the latest TRM (D4); incomplete without one. */
export function subscriptionCost(subscriptions: SubscriptionRecord[], rate: string | null) {
  const missingRate = subscriptions.some((item) => item.status === "active" && item.currency === "USD") && !rate;
  const amounts = subscriptions.filter((item) => item.currency === "COP" || rate).map((item) => ({ amountCop: toCop(new Decimal(item.amount), item.currency, item.currency === "USD" ? new Decimal(rate!) : undefined), frequency: item.frequency, status: item.status }));
  return { missingRate, ...subscriptionTotals(amounts) };
}

/** D35: deferred subscriptions show the installment each charge adds, with the card's current terms. */
export function deferredInstallments(subscriptions: SubscriptionRecord[], cards: RawCard[], rate: string | null, today: IsoDate): Record<string, string> {
  const installments: Record<string, string> = {};
  for (const item of subscriptions.filter((entry) => entry.installmentsCount > 1)) {
    const card = cards.find((entry) => entry.id === item.cardId);
    if (!card) continue;
    try {
      installments[item.id] = buildInstallmentPlan({ principal: new Decimal(item.amount), count: item.installmentsCount, annualRateEa: new Decimal(card.purchase_rate_ea), method: card.amortization_method,
        interestFree: false, currency: item.currency, fxRate: item.currency === "USD" ? new Decimal(rate ?? 1) : undefined, cutoffDay: card.cutoff_day, purchaseDate: today, interestMode: card.interest_mode }).firstInstallment.total.toFixed();
    } catch { /* The database rejects plans the amount cannot cover; the list then shows only the charge. */ }
  }
  return installments;
}

export type SubscriptionList = Awaited<ReturnType<typeof loadSubscriptionList>>;

/** Subscriptions (F4) with their cards, active categories, cost, registered charges and deferred installments (D35). */
export async function loadSubscriptionList(supabase: ServerClient, userId: string, today: IsoDate) {
  const [subscriptionResult, cardResult, categoryResult, rate] = await Promise.all([
    supabase.from("subscriptions").select("id,name,card_id,category_id,amount::text,currency,frequency,billing_day,start_date,trial_ends_at,status,installments_count").eq("user_id", userId).order("name"),
    supabase.from("cards").select("id,name,last4,color,archived_at,usd_default_installments,cutoff_day,purchase_rate_ea::text,amortization_method,interest_mode").eq("user_id", userId).order("name"),
    supabase.from("categories").select("id,name").eq("user_id", userId).is("archived_at", null).order("name"),
    loadLatestFxRate(supabase, userId),
  ]);
  if (subscriptionResult.error || cardResult.error || categoryResult.error) throw new Error("No pudimos consultar las suscripciones.");
  const subscriptions: SubscriptionRecord[] = ((subscriptionResult.data ?? []) as unknown as RawSubscription[]).map((item) => ({ id: item.id, name: item.name, cardId: item.card_id, categoryId: item.category_id, amount: item.amount, currency: item.currency, frequency: item.frequency, billingDay: item.billing_day, startDate: item.start_date, trialEndsAt: item.trial_ends_at, status: item.status, installmentsCount: item.installments_count }));
  const rawCards = (cardResult.data ?? []) as unknown as RawCard[];
  const cards: SubscriptionListCard[] = rawCards.map((card) => ({ id: card.id, name: card.name, last4: card.last4, color: card.color, archived_at: card.archived_at, usdDefaultInstallments: card.usd_default_installments }));
  let charges: SubscriptionChargeRow[] = [];
  if (subscriptions.length) {
    const result = await supabase.from("transactions").select("id,subscription_id,date,amount::text,currency").eq("user_id", userId).in("subscription_id", subscriptions.map((item) => item.id)).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (result.error) throw new Error("No pudimos consultar los cobros recientes.");
    charges = (result.data ?? []) as unknown as SubscriptionChargeRow[];
  }
  return {
    subscriptions,
    cards,
    activeCards: cards.filter((card) => !card.archived_at),
    categories: (categoryResult.data ?? []) as SubscriptionCategory[],
    rate,
    cost: subscriptionCost(subscriptions, rate),
    charges,
    installments: deferredInstallments(subscriptions, rawCards, rate, today),
  };
}
