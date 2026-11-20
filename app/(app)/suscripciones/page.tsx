import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { ChevronDown, Repeat } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { SubscriptionForm } from "@/components/subscription-form";
import { SubscriptionList, type SubscriptionCharge } from "@/components/subscription-list";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { todayInBogota } from "@/lib/domain/dates";
import { buildInstallmentPlan, type AmortizationMethod } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import { toCop } from "@/lib/domain/money";
import { subscriptionTotals } from "@/lib/domain/subscriptions";
import type { SubscriptionCard, SubscriptionCategory, SubscriptionRecord } from "@/lib/subscription-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Suscripciones" };
type RawSubscription = { id: string; name: string; card_id: string; category_id: string | null; amount: string; currency: "COP" | "USD"; frequency: "monthly" | "yearly"; billing_day: number; start_date: string; trial_ends_at: string | null; status: "active" | "paused" | "cancelled"; installments_count: number };
type Card = SubscriptionCard & { archived_at: string | null };
type RawCard = { id: string; name: string; last4: string; color: SubscriptionCard["color"]; archived_at: string | null; usd_default_installments: number; cutoff_day: number; purchase_rate_ea: string; amortization_method: AmortizationMethod; interest_mode: InterestMode };

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [subscriptionResult, cardResult, categoryResult, rateResult] = await Promise.all([
    supabase.from("subscriptions").select("id,name,card_id,category_id,amount::text,currency,frequency,billing_day,start_date,trial_ends_at,status,installments_count").eq("user_id", user.id).order("name"),
    supabase.from("cards").select("id,name,last4,color,archived_at,usd_default_installments,cutoff_day,purchase_rate_ea::text,amortization_method,interest_mode").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id,name").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("fx_rates").select("usd_cop::text").order("date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (subscriptionResult.error || cardResult.error || categoryResult.error || rateResult.error) throw new Error("No pudimos consultar las suscripciones.");
  const subscriptions: SubscriptionRecord[] = ((subscriptionResult.data ?? []) as unknown as RawSubscription[]).map((item) => ({ id: item.id, name: item.name, cardId: item.card_id, categoryId: item.category_id, amount: item.amount, currency: item.currency, frequency: item.frequency, billingDay: item.billing_day, startDate: item.start_date, trialEndsAt: item.trial_ends_at, status: item.status, installmentsCount: item.installments_count }));
  const rawCards = (cardResult.data ?? []) as unknown as RawCard[];
  const cards: Card[] = rawCards.map((card) => ({ id: card.id, name: card.name, last4: card.last4, color: card.color, archived_at: card.archived_at, usdDefaultInstallments: card.usd_default_installments }));
  const activeCards = cards.filter((card) => !card.archived_at);
  const categories = (categoryResult.data ?? []) as SubscriptionCategory[];
  let rate = (rateResult.data as { usd_cop: string } | null)?.usd_cop ?? null;
  if (!rate) {
    const result = await supabase.from("transactions").select("fx_rate::text").eq("user_id", user.id).eq("currency", "USD").not("fx_rate", "is", null).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw new Error("No pudimos consultar la última TRM.");
    rate = (result.data as { fx_rate: string } | null)?.fx_rate ?? null;
  }
  const missingRate = subscriptions.some((item) => item.status === "active" && item.currency === "USD") && !rate;
  const amounts = subscriptions.filter((item) => item.currency === "COP" || rate).map((item) => ({ amountCop: toCop(new Decimal(item.amount), item.currency, item.currency === "USD" ? new Decimal(rate!) : undefined), frequency: item.frequency, status: item.status }));
  const totals = subscriptionTotals(amounts);
  const today = todayInBogota();
  const current = subscriptions.filter((item) => item.status !== "cancelled");
  const cancelled = subscriptions.filter((item) => item.status === "cancelled");
  let charges: SubscriptionCharge[] = [];
  if (subscriptions.length) {
    const result = await supabase.from("transactions").select("id,subscription_id,date,amount::text,currency").eq("user_id", user.id).in("subscription_id", subscriptions.map((item) => item.id)).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (result.error) throw new Error("No pudimos consultar los cobros recientes.");
    charges = (result.data ?? []) as unknown as SubscriptionCharge[];
  }
  // D35: deferred subscriptions show the installment each charge adds, with the card's current terms.
  const installments: Record<string, string> = {};
  for (const item of subscriptions.filter((entry) => entry.installmentsCount > 1)) {
    const card = rawCards.find((entry) => entry.id === item.cardId);
    if (!card) continue;
    try {
      installments[item.id] = buildInstallmentPlan({ principal: new Decimal(item.amount), count: item.installmentsCount, annualRateEa: new Decimal(card.purchase_rate_ea), method: card.amortization_method,
        interestFree: false, currency: item.currency, fxRate: item.currency === "USD" ? new Decimal(rate ?? 1) : undefined, cutoffDay: card.cutoff_day, purchaseDate: today, interestMode: card.interest_mode }).firstInstallment.total.toFixed();
    } catch { /* The database rejects plans the amount cannot cover; the list then shows only the charge. */ }
  }
  const listProps = { cards, activeCards, categories, charges, today, installments };
  return <>
    <PageHeader title="Suscripciones" subtitle="Consulta tus cobros recurrentes." action={<SubscriptionForm cards={activeCards} categories={categories} today={today} />} />
    <div className="flex flex-col gap-6">
      {!activeCards.length && <p className="text-body text-muted-foreground">Agrega una tarjeta activa para registrar suscripciones. <Link href="/ajustes" className="underline">Ir a ajustes</Link></p>}
      {subscriptions.length ? <>
        <section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4" aria-label="Costo de suscripciones activas">
          <p className="text-small text-muted-foreground">Costo mensual</p>
          {missingRate ? <p className="text-body">No podemos estimar el total sin una TRM.</p> : <>
            <Money value={totals.monthly} currency="COP" size="lg" />
            <p className="text-small text-muted-foreground">Anual equivalente: <Money value={totals.yearly} currency="COP" />{subscriptions.some((item) => item.status === "active" && item.currency === "USD") && " · estimado con la última TRM"}</p>
            {subscriptions.some((item) => item.status === "active" && item.installmentsCount > 1) && <p className="text-small text-muted-foreground">Suma el valor de cada cobro. Los diferidos se pagan en cuotas, sin contar sus intereses.</p>}
          </>}
        </section>
        {current.length > 0 ? <section aria-label="Lista de suscripciones"><SubscriptionList subscriptions={current} {...listProps} /></section> : <p className="text-body text-muted-foreground">No tienes suscripciones activas ni pausadas.</p>}
        {cancelled.length > 0 && <Disclosure>
          <DisclosureSummary><span>Canceladas ({cancelled.length})</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary>
          <DisclosureContent><SubscriptionList subscriptions={cancelled} {...listProps} /></DisclosureContent>
        </Disclosure>}
      </> : <EmptyState icon={Repeat} text={activeCards.length ? "Aún no tienes suscripciones. Agrega la primera." : "Aún no tienes suscripciones."} />}
    </div>
  </>;
}
