import type { ReactNode } from "react";
import Link from "next/link";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { StatementPaymentControl } from "@/components/statement-payment-control";
import { StatusBadge } from "@/components/status-badge";
import type { CardColor } from "@/lib/card-colors";
import { compareIsoDates } from "@/lib/domain/dates";
import { statementKnownTotal, type MonthCardSummary } from "@/lib/domain/months";
import { formatDateShort } from "@/lib/format";
import { statementStatusLabels } from "@/lib/month-status";

type CardIdentity = { id: string; name: string; last4: string; color: CardColor };

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
    <dt className="min-w-0 text-muted-foreground">{label}</dt>
    <dd className="ml-auto text-right">{children}</dd>
  </div>;
}

/** One card's statements in the payment month, with saved dates and compact payment marking for real statements. */
export function MonthStatementCard({ group, card, today }: { group: MonthCardSummary; card: CardIdentity | undefined; today: string }) {
  const name = card ? `${card.name} · •••• ${card.last4}` : "Tarjeta";
  const several = group.statements.length > 1;
  return <section aria-label={name} className="grid gap-4 rounded-xl border border-border bg-card p-4">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
      {card ? <CardColorChip color={card.color} name={name} /> : <span className="text-small">{name}</span>}
      <Money value={group.total} currency="COP" />
    </div>
    {group.statements.map(({ statement, status }) => {
      const cutoff = formatDateShort(statement.cutoffDate, today);
      const context = `${name} · corte ${cutoff}`;
      const label = statementStatusLabels[status];
      const open = compareIsoDates(statement.cutoffDate, today) >= 0;
      return <div key={statement.id ?? `${group.cardId}:${statement.cutoffDate}`} className="grid gap-3 border-t border-border pt-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <StatusBadge text={label.text} tone={label.tone} />
          {statement.periodStart && <p className="text-small text-muted-foreground">Compras del {formatDateShort(statement.periodStart, today)} al {cutoff}</p>}
        </div>
        <dl className="grid gap-1 text-small">
          {!statement.periodStart && <Row label="Corte">{cutoff}</Row>}
          <Row label="Fecha límite de pago">{formatDateShort(statement.dueDate, today)}</Row>
          {statement.origin === "real" && <Row label="Registrado"><Money value={statement.recordedTotal} currency="COP" /></Row>}
          {!statement.projectedTotal.isZero() && <Row label="Previsto"><Money value={statement.projectedTotal} currency="COP" /></Row>}
          {statement.unconvertedCharges.length > 0 && <Row label="Previstos en USD">Pendientes de conversión</Row>}
          {several && <Row label={statement.unconvertedCharges.length ? "Total conocido" : "Total del extracto"}><Money value={statementKnownTotal(statement)} currency="COP" /></Row>}
        </dl>
        {statement.origin === "real" && statement.id && <div className="grid gap-3">
          <Link className="w-fit text-body underline pointer-coarse:min-h-11" href={`/tarjetas/${statement.cardId}/extractos/${statement.cutoffDate}`}>Ver extracto<span className="sr-only"> · {context}</span></Link>
          <StatementPaymentControl id={statement.id} paid={Boolean(statement.paidAt)} today={today} context={context} openUntil={open ? cutoff : undefined} />
        </div>}
      </div>;
    })}
  </section>;
}
