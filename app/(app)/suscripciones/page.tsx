import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { Repeat } from "lucide-react";
import { CardColorChip } from "@/components/card-color-chip";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubscriptionForm } from "@/components/subscription-form";
import { SubscriptionStatusActions } from "@/components/subscription-status-actions";
import { addDays, todayInBogota } from "@/lib/domain/dates";
import { toCop } from "@/lib/domain/money";
import { isTrialEndingSoon, nextChargeDate, subscriptionTotals } from "@/lib/domain/subscriptions";
import { formatDateShort } from "@/lib/format";
import type { SubscriptionCard, SubscriptionCategory, SubscriptionRecord } from "@/lib/subscription-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Suscripciones" };
type RawSubscription = { id: string; name: string; card_id: string; category_id: string | null; amount: string; currency: "COP" | "USD"; frequency: "monthly" | "yearly"; billing_day: number; start_date: string; trial_ends_at: string | null; status: "active" | "paused" | "cancelled" };
type Card = SubscriptionCard & { archived_at: string | null };
type Charge = { id: string; subscription_id: string | null; date: string; amount: string; currency: "COP" | "USD" };

export default async function SubscriptionsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [subscriptionResult, cardResult, categoryResult, rateResult] = await Promise.all([
    supabase.from("subscriptions").select("id,name,card_id,category_id,amount::text,currency,frequency,billing_day,start_date,trial_ends_at,status").eq("user_id", user.id).order("name"),
    supabase.from("cards").select("id,name,last4,color,archived_at").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id,name").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("fx_rates").select("usd_cop::text").order("date", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (subscriptionResult.error || cardResult.error || categoryResult.error || rateResult.error) throw new Error("No pudimos consultar las suscripciones.");
  const subscriptions: SubscriptionRecord[] = ((subscriptionResult.data ?? []) as unknown as RawSubscription[]).map((item) => ({ id: item.id, name: item.name, cardId: item.card_id, categoryId: item.category_id, amount: item.amount, currency: item.currency, frequency: item.frequency, billingDay: item.billing_day, startDate: item.start_date, trialEndsAt: item.trial_ends_at, status: item.status }));
  const cards = (cardResult.data ?? []) as Card[];
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
  const trials = subscriptions.filter((item) => item.status === "active" && isTrialEndingSoon(item.trialEndsAt, today));
  let charges: Charge[] = [];
  if (subscriptions.length) {
    const result = await supabase.from("transactions").select("id,subscription_id,date,amount::text,currency").eq("user_id", user.id).in("subscription_id", subscriptions.map((item) => item.id)).order("date", { ascending: false }).order("created_at", { ascending: false });
    if (result.error) throw new Error("No pudimos consultar los cobros recientes.");
    charges = (result.data ?? []) as unknown as Charge[];
  }
  return <><PageHeader title="Suscripciones" subtitle="Consulta tus cobros recurrentes." action={<SubscriptionForm cards={activeCards} categories={categories} today={today} />} /><div className="flex max-w-2xl flex-col gap-6">{!activeCards.length && <p className="text-body text-muted-foreground">Agrega una tarjeta activa para registrar suscripciones.</p>}{subscriptions.length ? <><section className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"><p className="text-small text-muted-foreground">Costo mensual</p>{missingRate ? <p className="text-body">No podemos estimar el total sin una TRM.</p> : <><Money value={totals.monthly} currency="COP" size="lg" /><p className="text-small text-muted-foreground">Anual equivalente: <Money value={totals.yearly} currency="COP" />{subscriptions.some((item) => item.status === "active" && item.currency === "USD") && " · estimado con la última TRM"}</p></>}</section>{trials.length > 0 && <section className="flex flex-col gap-3"><h2 className="text-heading">Pruebas por vencer</h2>{trials.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-4"><span className="text-body">{item.name}</span><StatusBadge tone="warning" text={`La prueba termina el ${formatDateShort(item.trialEndsAt!, today)}`} /></div>)}</section>}<section className="flex flex-col gap-4" aria-label="Lista de suscripciones">{subscriptions.map((item) => { const card = cards.find((entry) => entry.id === item.cardId); const recent = charges.filter((charge) => charge.subscription_id === item.id).slice(0, 3); const next = nextChargeDate({ startDate: item.startDate, frequency: item.frequency, billingDay: item.billingDay, status: item.status, trialEndsAt: item.trialEndsAt }, recent.some((charge) => charge.date === today) ? addDays(today, 1) : today); return <article key={item.id} id={`suscripcion-${item.id}`} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"><div className="flex justify-between gap-4"><div className="flex flex-col gap-2"><h2 className="text-heading">{item.name}</h2>{card && <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} />}<p className="text-small text-muted-foreground">{item.frequency === "monthly" ? "Mensual" : "Anual"}{next ? ` · próximo cobro ${formatDateShort(next, today)}` : ""}</p>{item.status !== "active" && <StatusBadge tone="neutral" text={item.status === "paused" ? "Pausada" : "Cancelada"} />}</div><span className="text-right"><Money value={item.amount} currency={item.currency} /></span></div>{recent.length > 0 && <div className="flex flex-col gap-2"><h3 className="text-small font-medium">Últimos cobros</h3>{recent.map((charge) => <Link key={charge.id} href={`/movimientos/${charge.id}`} className="flex min-h-11 items-center justify-between gap-3 text-small"><span>{formatDateShort(charge.date, today)}</span><span className="text-right"><Money value={charge.amount} currency={charge.currency} /></span></Link>)}</div>}<div className="flex flex-wrap gap-2"><SubscriptionForm cards={activeCards} categories={categories} today={today} subscription={item} /><SubscriptionStatusActions id={item.id} status={item.status} /></div></article>; })}</section></> : <EmptyState icon={Repeat} text="Aún no tienes suscripciones. Agrega la primera." />}</div></>;
}
