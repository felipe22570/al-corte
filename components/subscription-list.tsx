import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { SubscriptionForm } from "@/components/subscription-form";
import { SubscriptionStatusActions } from "@/components/subscription-status-actions";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { addDays } from "@/lib/domain/dates";
import { isTrialEndingSoon, nextChargeDate } from "@/lib/domain/subscriptions";
import { formatDateShort } from "@/lib/format";
import type { SubscriptionCard, SubscriptionCategory, SubscriptionRecord } from "@/lib/subscription-types";

export type SubscriptionCharge = { id: string; subscription_id: string | null; date: string; amount: string; currency: "COP" | "USD" };

export function SubscriptionList({ subscriptions, cards, activeCards, categories, charges, today }: {
  subscriptions: SubscriptionRecord[];
  cards: SubscriptionCard[];
  activeCards: SubscriptionCard[];
  categories: SubscriptionCategory[];
  charges: SubscriptionCharge[];
  today: string;
}) {
  return <div className="divide-y divide-border rounded-xl border border-border bg-card">
    {subscriptions.map((item) => {
      const card = cards.find((entry) => entry.id === item.cardId);
      const recent = charges.filter((charge) => charge.subscription_id === item.id).slice(0, 3);
      const next = nextChargeDate(item, recent.some((charge) => charge.date === today) ? addDays(today, 1) : today);
      const trialEnding = item.status === "active" && isTrialEndingSoon(item.trialEndsAt, today);
      return <article key={item.id} id={`suscripcion-${item.id}`} className="grid min-w-0 grid-cols-1 items-start gap-x-4 gap-y-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="flex min-w-0 flex-col items-start gap-1 wrap-anywhere">
          <h2 className="text-body font-medium">{item.name}</h2>
          {card && <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} />}
          <p className="text-small text-muted-foreground">{item.frequency === "monthly" ? "Mensual" : "Anual"}{next ? ` · próximo cobro ${formatDateShort(next, today)}` : ""}</p>
          {item.status === "paused" && <StatusBadge tone="neutral" text="Pausada" />}
          {trialEnding && <StatusBadge tone="warning" text={`Prueba hasta el ${formatDateShort(item.trialEndsAt!, today)}`} />}
        </div>
        <span className="text-right"><Money value={item.amount} currency={item.currency} /></span>
        <div className="flex min-w-0 flex-wrap items-start justify-end gap-1">
          <SubscriptionForm cards={activeCards} categories={categories} today={today} subscription={item} />
          <SubscriptionStatusActions id={item.id} status={item.status} name={item.name} />
        </div>
        {recent.length > 0 && <Disclosure className="sm:col-span-3">
          <DisclosureSummary className="justify-start text-small text-muted-foreground">Últimos cobros<span className="sr-only"> de {item.name}</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary>
          <DisclosureContent className="pt-1">
            {recent.map((charge) => <Link key={charge.id} href={`/movimientos/${charge.id}`} className="flex min-h-10 items-center justify-between gap-3 rounded-md text-small underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">
              <span>{formatDateShort(charge.date, today)}</span><span className="text-right"><Money value={charge.amount} currency={charge.currency} /></span>
            </Link>)}
          </DisclosureContent>
        </Disclosure>}
      </article>;
    })}
  </div>;
}
