import Link from "next/link";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { StatementStatus } from "@/components/statement-status";
import { StatusBadge } from "@/components/status-badge";
import { cardColorClasses, type CardColor } from "@/lib/card-colors";
import { addDays } from "@/lib/domain/dates";
import { cardCompositionPercentages, monthOpenGrowth, type MonthCardSummary, type PaymentMonthSummary } from "@/lib/domain/months";
import { formatDateShort, formatMonth } from "@/lib/format";
import { monthStatusLabels } from "@/lib/month-status";

type CardIdentity = { id: string; name: string; last4: string; color: CardColor };

/** Earliest unpaid real statement of the card, or its first statement when all are paid or projected. */
function nextStatement(summary: MonthCardSummary) {
  const unpaid = summary.statements
    .filter(({ statement }) => statement.origin === "real" && !statement.paidAt)
    .sort((a, b) => a.statement.dueDate.localeCompare(b.statement.dueDate));
  return unpaid[0] ?? summary.statements[0];
}

function totalLabel(month: PaymentMonthSummary) {
  if (!month.complete) return "Total conocido";
  return month.kind === "future" ? "Total estimado" : "Total del mes";
}

export function MonthRow({ month, cards, subscriptionNames, today, featured = false }: {
  month: PaymentMonthSummary; cards: CardIdentity[]; subscriptionNames: Record<string, string>; today: string; featured?: boolean;
}) {
  const identities = new Map(cards.map((card) => [card.id, card]));
  const composition = month.cards.length > 1 ? cardCompositionPercentages(month) : null;
  const status = month.status ? monthStatusLabels[month.status] : null;
  const hasReal = month.statements.some((statement) => statement.origin === "real");
  const showPending = hasReal && month.status !== "paid" && !month.pendingConfirmation.eq(month.total);
  const soon = addDays(today, 5);

  const summary = <div className="grid min-w-0 content-start gap-3">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="grid min-w-0 gap-1">
        <h3 className="text-heading">{formatMonth(month.month, "long")}</h3>
        {status ? <StatusBadge text={status.text} tone={status.tone} /> : <p className="text-small text-muted-foreground">Sin extractos</p>}
      </div>
      <div className="min-w-0 text-right">
        <p className="text-small text-muted-foreground">{totalLabel(month)}</p>
        <Money value={month.total} currency="COP" size={featured ? "lg" : "md"} />
        {month.total.isNegative() && <p className="text-small">Saldo a favor</p>}
      </div>
    </div>
    {showPending && <div className="text-small">
      <p>Pendiente de confirmar pago: <Money value={month.pendingConfirmation} currency="COP" /></p>
      <p className="text-muted-foreground">Suma de extractos sin marcar como pagados. No descuenta abonos registrados.</p>
    </div>}
    {month.hasProjection && <p className="text-small">
      Cobros previstos{!month.complete && month.projected.isZero()
        ? ": pendientes de conversión"
        : <>: <Money value={month.projected} currency="COP" />{!month.complete && " conocidos"}</>}
    </p>}
    {featured && month.hasOpenStatements && hasReal && <p className="flex flex-wrap gap-x-4 text-small text-muted-foreground">
      <span className="whitespace-nowrap">Ya facturado <Money value={month.billed} currency="COP" /></span>
      <span className="whitespace-nowrap">Aún puede crecer <Money value={monthOpenGrowth(month)} currency="COP" /></span>
    </p>}
    {!month.complete && <div className="text-small">
      <p>Estimación incompleta: faltan cobros en USD sin convertir.</p>
      {month.unconvertedCharges.map((charge) => <p key={`${charge.subscriptionId}:${charge.date}`}>{subscriptionNames[charge.subscriptionId] ?? "Suscripción"}: <Money value={charge.amountUsd} currency="USD" /></p>)}
    </div>}
  </div>;

  const legend = month.cards.length > 0 && <div className="grid min-w-0 content-start gap-3">
    {composition && <div aria-hidden="true" className="flex h-2 overflow-hidden rounded-full bg-secondary">
      {composition.map(({ cardId, percent }) => {
        const card = identities.get(cardId);
        return card ? <span key={cardId} className={cardColorClasses[card.color]} style={{ width: `${percent}%` }} /> : null;
      })}
    </div>}
    {featured ? <div className="grid gap-2">
      {month.cards.map((subtotal) => {
        const card = identities.get(subtotal.cardId);
        const next = nextStatement(subtotal);
        const dueSoon = next && next.statement.origin === "real" && !next.statement.paidAt && next.statement.dueDate <= soon;
        return <div key={subtotal.cardId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            {card ? <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} /> : <span className="text-small">Tarjeta</span>}
            {next && <span className="text-small text-muted-foreground">pago {formatDateShort(next.statement.dueDate, today)}</span>}
            {dueSoon && <StatementStatus dueDate={next.statement.dueDate} paidAt={null} today={today} />}
          </span>
          <Money value={subtotal.total} currency="COP" />
        </div>;
      })}
    </div> : <div className="grid min-w-0 gap-1">
      {month.cards.map((subtotal) => {
        const card = identities.get(subtotal.cardId);
        // Name wraps in its own column so long card names never push the amount off the right edge.
        return <div key={subtotal.cardId} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
          {card ? <CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} /> : <span className="text-small">Tarjeta</span>}
          <span className="text-right"><Money value={subtotal.total} currency="COP" /></span>
        </div>;
      })}
    </div>}
  </div>;

  return (
    <Link href={`/meses/${month.month}`} className="block min-w-0 rounded-xl border border-border bg-card p-4 motion-safe:transition-colors hover:border-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className={featured && legend ? "grid gap-4 lg:grid-cols-2 lg:gap-8" : "grid gap-3"}>
        {summary}
        {legend}
      </div>
    </Link>
  );
}
