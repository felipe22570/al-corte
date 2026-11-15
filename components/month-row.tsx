import Link from "next/link";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import { cardColorClasses, type CardColor } from "@/lib/card-colors";
import { cardCompositionPercentages, type PaymentMonthSummary } from "@/lib/domain/months";
import { formatMonth } from "@/lib/format";

type CardIdentity = { id: string; name: string; last4: string; color: CardColor };
const statuses = {
  overdue: { text: "Vencido", tone: "danger" },
  pending: { text: "Pendiente", tone: "neutral" },
  paid: { text: "Pagado", tone: "ok" },
  estimated: { text: "Estimado", tone: "neutral" },
} as const;

export function MonthRow({ month, cards, subscriptionNames, featured = false }: {
  month: PaymentMonthSummary; cards: CardIdentity[]; subscriptionNames: Record<string, string>; featured?: boolean;
}) {
  const identities = new Map(cards.map((card) => [card.id, card]));
  const composition = cardCompositionPercentages(month);
  const status = month.status ? statuses[month.status] : null;
  return (
    <Link href={`/meses/${month.month}`} className="block min-w-0 rounded-xl border border-border bg-card p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-heading">{formatMonth(month.month, "long")}</h3>
          {status ? <StatusBadge text={status.text} tone={status.tone} /> : <p className="text-small text-muted-foreground">Sin extractos</p>}
        </div>
        <div className="min-w-0 text-right">
          <p className="text-small text-muted-foreground">{month.complete ? "Total del mes" : "Total conocido"}</p>
          <Money value={month.total} currency="COP" size={featured ? "lg" : "md"} />
          {month.total.isNegative() && <p className="text-small">Saldo a favor</p>}
        </div>
      </div>
      {!month.pendingConfirmation.eq(month.total) && month.statements.some((statement) => statement.origin === "real") && (
        <div className="mt-3 text-small">
          <p>Pendiente de confirmar pago: <Money value={month.pendingConfirmation} currency="COP" /></p>
          <p className="text-muted-foreground">Suma de extractos sin marcar como pagados. No descuenta abonos registrados.</p>
        </div>
      )}
      {month.hasProjection && <p className="mt-3 text-small">
        Cobros previstos{!month.complete && month.projected.isZero()
          ? ": pendientes de conversión"
          : <>: <Money value={month.projected} currency="COP" />{!month.complete && " conocidos"}</>}
      </p>}
      {!month.complete && (
        <div className="mt-3 text-small">
          <p>Estimación incompleta. Revisa la TRM.</p>
          {month.unconvertedCharges.map((charge) => <p key={`${charge.subscriptionId}:${charge.date}`}>{subscriptionNames[charge.subscriptionId] ?? "Suscripción"}: <Money value={charge.amountUsd} currency="USD" /></p>)}
        </div>
      )}
      {composition && (
        <div aria-label="Barra de composición" className="mt-3 flex h-2 overflow-hidden rounded-full bg-secondary">
          {composition.map(({ cardId, percent }) => {
            const card = identities.get(cardId);
            return card ? <span key={cardId} className={cardColorClasses[card.color]} style={{ width: `${percent}%` }} /> : null;
          })}
        </div>
      )}
      {month.cards.length > 0 && <div className="mt-3 grid gap-2">
        {month.cards.map((subtotal) => {
          const card = identities.get(subtotal.cardId);
          return <div key={subtotal.cardId} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            {card ? <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} /> : <span className="text-small">Tarjeta</span>}
            <Money value={subtotal.total} currency="COP" />
          </div>;
        })}
      </div>}
    </Link>
  );
}
