import type { ReactNode } from "react";
import Decimal from "decimal.js";
import Link from "next/link";
import { CardColorChip } from "@/components/card-color-chip";
import { CurrencyAmounts, CurrencyInline } from "@/components/currency-amounts";
import { StatementPaymentControl } from "@/components/statement-payment-control";
import { StatementPaymentForm } from "@/components/statement-payment-form";
import { StatusBadge } from "@/components/status-badge";
import type { CardColor } from "@/lib/card-colors";
import { compareIsoDates } from "@/lib/domain/dates";
import { currencyPaidAt, statementKnownTotal, statementUsdTotal, type MonthCardSummary } from "@/lib/domain/months";
import type { Currency } from "@/lib/domain/money";
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
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3">
      {card ? <CardColorChip color={card.color} name={name} /> : <span className="text-small">{name}</span>}
      <span className="text-right"><CurrencyAmounts cop={group.total} usd={group.totalUsd} /></span>
    </div>
    {group.statements.map(({ statement, status }) => {
      const cutoff = formatDateShort(statement.cutoffDate, today);
      const context = `${name} · corte ${cutoff}`;
      const label = statementStatusLabels[status];
      const open = compareIsoDates(statement.cutoffDate, today) >= 0;
      const recordedUsd = statement.recordedUsd ?? new Decimal(0);
      // D33: each currency with charges is marked separately; pesos when the statement has no charges yet.
      const currencies: Currency[] = [
        ...(!statement.recordedTotal.isZero() || recordedUsd.isZero() ? ["COP" as const] : []),
        ...(!recordedUsd.isZero() ? ["USD" as const] : []),
      ];
      return <div key={statement.id ?? `${group.cardId}:${statement.cutoffDate}`} className="grid gap-3 border-t border-border pt-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <StatusBadge text={label.text} tone={label.tone} />
          {statement.periodStart && <p className="text-small text-muted-foreground">Compras del {formatDateShort(statement.periodStart, today)} al {cutoff}</p>}
        </div>
        <dl className="grid gap-1 text-small">
          {!statement.periodStart && <Row label="Corte">{cutoff}</Row>}
          <Row label="Fecha límite de pago">{formatDateShort(statement.dueDate, today)}</Row>
          {statement.origin === "real" && <Row label="Registrado"><CurrencyInline cop={statement.recordedTotal} usd={recordedUsd} /></Row>}
          {!(statement.projectedTotal.isZero() && (statement.projectedUsd?.isZero() ?? true)) && <Row label="Previsto"><CurrencyInline cop={statement.projectedTotal} usd={statement.projectedUsd ?? "0"} /></Row>}
          {statement.unconvertedCharges.length > 0 && <Row label="Equivalente en pesos">Falta la TRM</Row>}
          {several && <Row label="Total del extracto"><CurrencyInline cop={statementKnownTotal(statement)} usd={statementUsdTotal(statement)} /></Row>}
          {statement.debt && <Row label="Deuda total"><CurrencyInline cop={statement.debt.COP} usd={statement.debt.USD} /></Row>}
        </dl>
        {statement.origin === "real" && statement.id && <div className="grid gap-3">
          <Link className="w-fit text-body underline pointer-coarse:min-h-11" href={`/tarjetas/${statement.cardId}/extractos/${statement.cutoffDate}`}>Ver extracto<span className="sr-only"> · {context}</span></Link>
          {currencies.map((currency) => {
            const currencyContext = currencies.length > 1 ? `${context} · ${currency === "COP" ? "pesos" : "dólares"}` : context;
            const currencyName = currencies.length > 1 ? (currency === "COP" ? "pesos" : "dólares") : undefined;
            // D37: payments are registered for statements already cut; marking without a value (D26) stays available.
            return <div key={currency} className="grid gap-2">{!open && <StatementPaymentForm statementId={statement.id!} currency={currency} currencyName={currencyName} today={today} context={currencyContext} />}<StatementPaymentControl id={statement.id!} currency={currency} currencyName={currencies.length > 1 ? (currency === "COP" ? "pesos" : "dólares") : undefined} paid={Boolean(currencyPaidAt(statement, currency))} today={today} context={currencyContext} openUntil={open && currency === currencies[0] ? cutoff : undefined} /></div>;
          })}
        </div>}
      </div>;
    })}
  </section>;
}
