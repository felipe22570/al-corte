import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown, Repeat } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { SubscriptionForm } from "@/components/subscription-form";
import { SubscriptionList } from "@/components/subscription-list";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { todayInBogota } from "@/lib/domain/dates";
import { loadSubscriptionList } from "@/lib/queries/subscription-list";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata: Metadata = { title: "Suscripciones" };

export default async function SubscriptionsPage() {
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const { subscriptions, cards, activeCards, categories, cost, charges, installments } = await loadSubscriptionList(supabase, user.id, today);
  const { missingRate, ...totals } = cost;
  const current = subscriptions.filter((item) => item.status !== "cancelled");
  const cancelled = subscriptions.filter((item) => item.status === "cancelled");
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
