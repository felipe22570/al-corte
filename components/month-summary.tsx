import type { ReactNode } from "react";
import Decimal from "decimal.js";
import { CurrencyAmounts, CurrencyInline } from "@/components/currency-amounts";
import { Money } from "@/components/money";
import { StatusBadge } from "@/components/status-badge";
import type { CardColor } from "@/lib/card-colors";
import { compareIsoDates } from "@/lib/domain/dates";
import { confirmedPaymentTotal, monthOpenGrowth, statementKnownTotal, statementUsdTotal, type PaymentMonthSummary } from "@/lib/domain/months";
import { formatCop, formatDateShort, formatUsd } from "@/lib/format";
import { monthStatusLabels } from "@/lib/month-status";

type CardIdentity = { id: string; name: string; last4: string; color: CardColor };
type Comparison = { text: string; diff: Decimal; usdDiff?: Decimal | null } | null;

function Row({ label, children, muted = false }: { label: ReactNode; children: ReactNode; muted?: boolean }) {
  return <div className={`flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 ${muted ? "text-muted-foreground" : ""}`}>
    <dt className="min-w-0">{label}</dt>
    <dd className="ml-auto text-right">{children}</dd>
  </div>;
}

/** Month header: hero total, payment confirmation split (D26) and, for the open current month, billed vs growth (D19). */
export function MonthSummary({ month, cards, today, comparison }: { month: PaymentMonthSummary; cards: CardIdentity[]; today: string; comparison: Comparison }) {
  const status = month.status ? monthStatusLabels[month.status] : null;
  const hasReal = month.statements.some((statement) => statement.origin === "real");
  const confirmed = confirmedPaymentTotal(month);
  const showGrowth = month.kind === "current" && month.hasOpenStatements;
  const names = new Map(cards.map((card) => [card.id, `${card.name} · •••• ${card.last4}`]));
  const open = month.statements.filter((statement) => compareIsoDates(statement.cutoffDate, today) >= 0);
  const label = month.kind === "future" ? "Total estimado" : "Total del mes";

  return <section aria-label="Resumen del mes" className={`grid gap-4 rounded-xl border border-border bg-card p-4 ${showGrowth ? "lg:grid-cols-2 lg:gap-8" : ""}`}>
    <div className="grid min-w-0 content-start gap-3">
      {status ? <StatusBadge text={status.text} tone={status.tone} /> : <p className="text-small text-muted-foreground">Sin extractos</p>}
      <div>
        <p className="text-small text-muted-foreground">{label}</p>
        <CurrencyAmounts cop={month.total} usd={month.totalUsd} size="lg" />
        {month.total.isNegative() && <p className="text-small">Saldo a favor</p>}
      </div>
      {(hasReal || month.hasProjection) && <dl className="grid gap-1 text-small">
        {hasReal && <Row label="Pendiente de confirmar pago"><CurrencyInline cop={month.pendingConfirmation} usd={month.pendingConfirmationUsd} /></Row>}
        {hasReal && !confirmed.isZero() && <Row label="Marcado como pagado"><Money value={confirmed} currency="COP" /></Row>}
        {month.hasProjection && <Row label="Cobros previstos"><CurrencyInline cop={month.projected} usd={month.projectedUsd} /></Row>}
        {month.debt && <Row label="Deuda total de los extractos" muted><CurrencyInline cop={month.debt.COP} usd={month.debt.USD} /></Row>}
        {!month.totalUsd.isZero() && <Row label="Equivalente de los dólares" muted>{month.complete ? <Money value={month.usdEquivalentCop} currency="COP" /> : "Falta la TRM"}</Row>}
      </dl>}
      {hasReal && <p className="text-small text-muted-foreground">Suma de extractos sin marcar como pagados. No descuenta abonos registrados.</p>}
      {comparison && <p className="text-small text-muted-foreground">{comparison.text} · <span className="whitespace-nowrap">Diferencia: {comparison.diff.gt(0) ? "+" : ""}{formatCop(comparison.diff)}</span>{comparison.usdDiff && <span className="whitespace-nowrap"> · En dólares: {comparison.usdDiff.gt(0) ? "+" : ""}{formatUsd(comparison.usdDiff)}</span>}</p>}
      {!comparison && month.kind !== "future" && <p className="text-small text-muted-foreground">{month.hasOpenStatements ? "Mes en curso" : "Comparación no disponible"}</p>}
      {month.kind === "future" && <p className="text-small">Se sumará lo que gastes antes de cada corte.</p>}
    </div>
    {showGrowth && <div className="grid min-w-0 content-start gap-3 border-t border-border pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
      <h2 className="text-heading">Así se compone este mes</h2>
      <dl className="grid gap-2 text-small">
        <Row label="Ya facturado"><Money value={month.billed} currency="COP" /></Row>
        <Row label="Aún puede crecer"><Money value={monthOpenGrowth(month)} currency="COP" /></Row>
        {open.map((statement) => {
          const name = names.get(statement.cardId) ?? "Tarjeta";
          const parts = [
            statement.origin === "real" && !(statement.recordedTotal.isZero() && (statement.recordedUsd?.isZero() ?? true)) ? <>registrado <CurrencyInline key="r" cop={statement.recordedTotal} usd={statement.recordedUsd ?? "0"} /></> : null,
            !(statement.projectedTotal.isZero() && (statement.projectedUsd?.isZero() ?? true)) ? <>previsto <CurrencyInline key="p" cop={statement.projectedTotal} usd={statement.projectedUsd ?? "0"} /></> : null,
          ].filter(Boolean);
          return <div key={statement.id ?? `${statement.cardId}:${statement.cutoffDate}`} className="grid gap-0.5 pl-3">
            <Row label={<>{name} · corta {formatDateShort(statement.cutoffDate, today)}</>}><CurrencyInline cop={statementKnownTotal(statement)} usd={statementUsdTotal(statement)} /></Row>
            {parts.length > 0 && <p className="text-muted-foreground">{parts.map((part, index) => <span key={index}>{index > 0 && " · "}{part}</span>)}</p>}
          </div>;
        })}
        <div className="border-t border-border pt-2 font-medium"><Row label={label}><CurrencyInline cop={month.total} usd={month.totalUsd} /></Row></div>
      </dl>
    </div>}
  </section>;
}
