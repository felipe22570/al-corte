import Decimal from "decimal.js";
import Link from "next/link";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { UtilizationBar } from "@/components/utilization-bar";
import type { MonthCardDetails } from "@/lib/queries/supabase-months";

export function MonthCardsStrip({ cards }: { cards: MonthCardDetails[] }) {
  const debt = cards.reduce((total, card) => total.plus(card.used), new Decimal(0));
  const active = cards.filter((card) => !card.archived);
  return (
    <section aria-labelledby="cards-heading" className="grid min-w-0 gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="cards-heading" className="text-heading">Tus tarjetas</h2>
        <p className="text-small text-muted-foreground">Deuda total registrada: <Money value={debt} currency="COP" /></p>
      </div>
      {active.length ? (
        <div className="flex min-w-0 gap-3 overflow-x-auto pb-2">
          {active.map((card) => (
            <Link key={card.id} href={`/tarjetas/${card.id}`} className="grid w-64 shrink-0 gap-3 rounded-xl border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} />
              <div><p className="text-small text-muted-foreground">Cupo disponible</p><Money value={card.available} currency="COP" /></div>
              <UtilizationBar percent={card.utilization.times(100).toNumber()} />
            </Link>
          ))}
        </div>
      ) : <p className="text-small text-muted-foreground">No tienes tarjetas activas.</p>}
    </section>
  );
}
