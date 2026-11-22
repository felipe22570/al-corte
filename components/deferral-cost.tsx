import type { ReactNode } from "react";
import Decimal from "decimal.js";
import { Money } from "@/components/money";
import type { deferralCostSummary } from "@/lib/domain/deferral-cost";
import type { Currency } from "@/lib/domain/money";
import { formatMoney, formatPercent } from "@/lib/format";

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
    <dt className="min-w-0 text-muted-foreground">{label}</dt>
    <dd className="ml-auto text-right">{children}</dd>
  </div>;
}

/**
 * F21: interest of a purchase or advance with the card rule (R11). With interest on the balance the bank does not split
 * its single interest line by purchase, so even what already accrued is an estimate.
 */
export function DeferralCost({ summary, currency, onBalance }: { summary: ReturnType<typeof deferralCostSummary>; currency: Currency; onBalance: boolean }) {
  const reference = summary.copReference;
  return <section aria-labelledby="deferral-title" className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
    <h2 id="deferral-title" className="text-heading">Costo de diferir</h2>
    <dl className="grid gap-1 text-small">
      <Row label={onBalance ? "Causados hasta el último corte (estimado)" : "Intereses facturados"}><Money value={summary.accrued} currency={currency} /></Row>
      <Row label={onBalance ? "Por causar (estimado)" : "Por pagar (estimado)"}><Money value={summary.pending} currency={currency} /></Row>
      <Row label="Total de intereses (estimado)"><Money value={summary.total} currency={currency} /></Row>
    </dl>
    <p className="text-small text-muted-foreground">Equivale al {formatPercent(new Decimal(summary.percent))} del valor{reference ? `, cerca de ${formatMoney(reference.total, "COP")} con la TRM de la compra` : ""}.</p>
    {onBalance && <p className="text-small text-muted-foreground">Tu banco cobra los intereses sobre el saldo en una sola línea por extracto y no los reparte por compra. Estas cifras son una estimación.</p>}
  </section>;
}
