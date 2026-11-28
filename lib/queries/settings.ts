import type { CardColor } from "@/lib/card-colors";
import { fetchAllPages } from "@/lib/paginate";
import type { CardRecord, CategoryRecord } from "@/lib/settings-types";
import type { ServerClient } from "@/lib/supabase/require-user";

type RawCard = {
  id: string; name: string; bank: string; network: string; last4: string; color: CardColor; archived_at: string | null;
  credit_limit: string; advance_fee: string; handling_fee: string; cutoff_day: number; payment_day: number;
  purchase_rate_ea: string; advance_rate_ea: string; amortization_method: "fixed_principal" | "french"; interest_mode: "per_installment" | "on_balance"; usd_default_installments: number; payment_allocation_rule: "bancolombia_priority" | "oldest_first" | "directed";
};
type RawCategory = { id: string; name: string; icon: string; archived_at: string | null };
export type CardAlias = { id: string; cardId: string; last4: string };

/** D32: the interest mode only changes while the card has no purchases in several installments. */
export function settingsCards(rows: RawCard[], cardsWithInstallments: ReadonlySet<string>): CardRecord[] {
  return rows.map((card) => ({
    id: card.id, name: card.name, bank: card.bank, network: card.network, last4: card.last4, color: card.color, archivedAt: card.archived_at,
    creditLimit: card.credit_limit, advanceFee: card.advance_fee, handlingFee: card.handling_fee,
    cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea,
    advanceRateEa: card.advance_rate_ea, amortizationMethod: card.amortization_method,
    interestMode: card.interest_mode, usdDefaultInstallments: card.usd_default_installments, paymentAllocationRule: card.payment_allocation_rule, hasInstallmentPurchases: cardsWithInstallments.has(card.id),
  }));
}

export type Settings = Awaited<ReturnType<typeof loadSettings>>;

/** Cards (active and archived), categories, capture switch (D51) and other last 4 digits of cards (D44). */
export async function loadSettings(supabase: ServerClient, userId: string) {
  const [cardResult, categoryResult, captureResult, aliasResult, installmentRows] = await Promise.all([
    supabase.from("cards").select("id,name,bank,network,last4,color,archived_at,credit_limit::text,advance_fee::text,handling_fee::text,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,amortization_method,interest_mode,usd_default_installments,payment_allocation_rule").eq("user_id", userId).order("name"),
    supabase.from("categories").select("id,name,icon,archived_at").eq("user_id", userId).order("name"),
    supabase.from("capture_settings").select("enabled").eq("user_id", userId).maybeSingle(),
    supabase.from("card_aliases").select("id,card_id,last4").eq("user_id", userId).order("last4"),
    // One read for every card instead of a count per card.
    fetchAllPages((from, to) => supabase.from("transactions").select("card_id").eq("user_id", userId).gt("installments_count", 1).order("id").range(from, to)),
  ]);
  if (cardResult.error || categoryResult.error || captureResult.error || aliasResult.error) throw new Error("No fue posible cargar los ajustes.");
  const cards = settingsCards((cardResult.data ?? []) as RawCard[], new Set((installmentRows as Array<{ card_id: string }>).map((row) => row.card_id)));
  const categories: CategoryRecord[] = ((categoryResult.data ?? []) as RawCategory[]).map((category) => ({ id: category.id, name: category.name, icon: category.icon, archivedAt: category.archived_at }));
  return {
    cards,
    activeCards: cards.filter((card) => !card.archivedAt),
    archivedCards: cards.filter((card) => card.archivedAt),
    categories,
    activeCategories: categories.filter((category) => !category.archivedAt),
    captureEnabled: (captureResult.data as { enabled: boolean } | null)?.enabled === true,
    aliases: ((aliasResult.data ?? []) as Array<{ id: string; card_id: string; last4: string }>).map((alias): CardAlias => ({ id: alias.id, cardId: alias.card_id, last4: alias.last4 })),
  };
}
