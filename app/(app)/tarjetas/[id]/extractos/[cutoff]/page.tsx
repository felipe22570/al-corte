import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExchangeDifference } from "@/components/exchange-difference";
import { Money } from "@/components/money";
import { CardColorChip } from "@/components/card-color-chip";
import { PageHeader } from "@/components/page-header";
import { PayInFullSavings } from "@/components/pay-in-full-savings";
import { StatementBalanceControls } from "@/components/statement-balance-controls";
import { StatementBreakdown } from "@/components/statement-breakdown";
import type { StatementConceptData } from "@/components/statement-concept";
import { StatementCloseForm, type StatementClosePurchase } from "@/components/statement-close-form";
import { StatementStatus } from "@/components/statement-status";
import { bankDifference } from "@/lib/domain/balances";
import { isValidIsoDate, todayInBogota } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";
import { isWithinMonthProjectionWindow, paymentMonth } from "@/lib/domain/months";
import { formatDateShort, formatMoney } from "@/lib/format";
import type { CurrencySummary } from "@/lib/queries/statement-balances";
import { loadStatementDetail, type StatementChargeConcept, type StatementEntry } from "@/lib/queries/statement-detail";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata: Metadata = { title: "Extracto" };
const conceptLabels: Record<StatementChargeConcept, string> = {
  single_purchases: "Compras", installments: "Cuotas", subscriptions: "Suscripciones", cash_advances: "Avances y comisiones", interest: "Intereses",
  handling_fees: "Cuota de manejo", insurance: "Seguros", adjustments: "Ajustes", refunds: "Devoluciones",
};
const currencyLabels: Record<Currency, { title: string; breakdown: string; payments: string; context: string }> = {
  COP: { title: "En pesos", breakdown: "Desglose en pesos", payments: "Pagos en pesos", context: "pesos" },
  USD: { title: "En dólares", breakdown: "Desglose en dólares", payments: "Pagos en dólares", context: "dólares" },
};

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
    <dt className="min-w-0 text-muted-foreground">{label}</dt>
    <dd className="ml-auto text-right">{children}</dd>
  </div>;
}

/** Bank value with the difference only when it exceeds the bank's rounding (R8). */
function BankValue({ calculated, real, currency }: { calculated: CurrencySummary["minimum"]; real: CurrencySummary["realMinimum"]; currency: Currency }) {
  if (!real) return null;
  const difference = bankDifference(calculated, real);
  return <><Money value={real} currency={currency} />{difference && <span className="block text-small text-muted-foreground">Diferencia: {difference.gt(0) ? "+" : ""}{formatMoney(difference, currency)}</span>}</>;
}

export default async function StatementDetailPage({ params }: { params: Promise<{ id: string; cutoff: string }> }) {
  const { id, cutoff } = await params;
  if (!z.uuid().safeParse(id).success || !isValidIsoDate(cutoff)) notFound();
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const detail = await loadStatementDetail(supabase, user.id, id, cutoff, today);
  if (!detail) notFound();
  const { card, statement, period, neighbors, hasEstimatedInterest, paidAt, headline, secondary, visible, breakdowns, paidFor, paidWithPesos, savings, closeContexts, closed } = detail;
  const cardName = `${card.name} · •••• ${card.last4}`;
  const entry = (item: StatementEntry, fallback: string): StatementConceptData["entries"][number] => ({
    id: item.id,
    href: `/movimientos/${item.transactionId}`,
    description: item.kind === "installment"
      ? `${item.merchant || "Compra"} · Cuota ${item.number}${item.installmentsCount === undefined ? "" : ` de ${item.installmentsCount}`}`
      : `${item.merchant || fallback} · ${formatDateShort(item.date!, today)}${item.prepaid ? " · con abono a capital" : ""}`,
    amountCop: item.amountCop,
    amountUsd: item.currency === "USD" ? item.amount : undefined,
  });
  const views = breakdowns.map(({ summary, concepts, payments }) => ({
    summary,
    concepts: concepts.map((concept): StatementConceptData => ({
      key: concept.key,
      label: concept.estimated ? "Intereses estimados" : conceptLabels[concept.key],
      currency: summary.currency,
      total: concept.total,
      subtract: concept.key === "refunds",
      entries: concept.entries.map((item) => entry(item, conceptLabels[concept.key])),
    })),
    payments: { key: "payments", label: "Abonos", currency: summary.currency, total: payments.total, subtract: true, entries: payments.entries.map((item) => entry(item, "Pago")) } satisfies StatementConceptData,
  }));
  const several = views.length > 1;
  const closes = closeContexts.map((context) => ({
    context, title: several ? `Cierre en ${currencyLabels[context.currency].context}` : "Cierre del extracto",
    purchases: context.purchases.map((purchase): StatementClosePurchase => ({
      id: purchase.id, label: purchase.merchant || (purchase.type === "cash_advance" ? "Avance" : "Compra"),
      detail: `${purchase.type === "cash_advance" ? "Avance" : "Compra"} del ${formatDateShort(purchase.date, today)} · ${purchase.installmentsCount} cuotas`,
      calculated: purchase.calculated.toFixed(), bankBalance: purchase.bankBalance?.toFixed() ?? null,
    })),
  }));

  return (
    <>
      <PageHeader title="Extracto" subtitle={<CardColorChip color={card.color} name={cardName} />} />
      <div className="flex flex-col gap-6">
        <section className="flex flex-col items-start gap-3">
          <h2 className="text-heading">Pago mínimo</h2>
          <Money value={headline.minimum} currency={headline.currency} size="lg" />
          {secondary && <p className="text-body">y <Money value={secondary.minimum} currency="USD" /></p>}
          {hasEstimatedInterest && <p className="text-small text-muted-foreground">Incluye intereses estimados</p>}
          <p className="text-body">{formatDateShort(period.periodStart, today)} – {formatDateShort(cutoff, today)} · pagas el {formatDateShort(period.dueDate, today)}</p>
          {statement && <StatementStatus dueDate={statement.due_date} paidAt={paidAt} today={today} />}
          {statement && isWithinMonthProjectionWindow(statement.due_date, today) && <Link className="text-body underline" href={`/meses/${paymentMonth(statement.due_date)}`}>Ver mes de pago</Link>}
        </section>
        {statement && <div className="grid items-start gap-6 xl:grid-cols-2">
          {visible.map((summary) => {
            const labels = currencyLabels[summary.currency];
            const context = `${cardName} · corte ${formatDateShort(cutoff, today)} · ${labels.context}`;
            return <section key={summary.currency} aria-labelledby={`balance-${summary.currency}`} className="grid gap-4 rounded-xl border border-border bg-card p-4">
              <h2 id={`balance-${summary.currency}`} className="text-heading">{labels.title}</h2>
              <dl className="grid gap-1 text-small">
                <Row label="Pago mínimo"><Money value={summary.minimum} currency={summary.currency} /></Row>
                <Row label="Deuda total"><Money value={summary.debt} currency={summary.currency} /></Row>
                {paidFor[summary.currency] && <Row label="Pagos registrados a este extracto"><Money value={paidFor[summary.currency]!} currency={summary.currency} /></Row>}
                {summary.currency === "USD" && <Row label="Equivalente en pesos (referencia)"><Money value={summary.equivalentCop} currency="COP" /></Row>}
                {summary.currency === "USD" && paidWithPesos.usd.gt(0) && <Row label="Pagado en pesos"><Money value={paidWithPesos.cop} currency="COP" /></Row>}
                {summary.realMinimum && <Row label="Pago mínimo del banco"><BankValue calculated={summary.minimum} real={summary.realMinimum} currency={summary.currency} /></Row>}
                {summary.realTotal && <Row label="Deuda total del banco"><BankValue calculated={summary.debt} real={summary.realTotal} currency={summary.currency} /></Row>}
              </dl>
              {summary.currency === "USD" && <ExchangeDifference paidUsd={paidWithPesos.usd} paidCop={paidWithPesos.cop} chargesUsd={summary.minimum} chargesCop={summary.equivalentCop} />}
              <PayInFullSavings amount={savings?.[summary.currency]} currency={summary.currency} />
              <StatementBalanceControls id={statement.id} currency={summary.currency} paid={!!summary.paidAt} today={today} context={context} closed={closed} />
            </section>;
          })}
        </div>}
        {statement ? views.map(({ summary, concepts, payments }) => {
          const labels = currencyLabels[summary.currency];
          return <StatementBreakdown key={summary.currency} concepts={concepts} payments={payments} title={several ? labels.breakdown : "Desglose"} paymentsTitle={several ? labels.payments : "Pagos"} idSuffix={several ? `-${summary.currency.toLowerCase()}` : ""} />;
        }) : <p className="text-body text-muted-foreground">Aún no hay movimientos en este extracto.</p>}
        {closes.length > 0 && <div id="cierre" className="grid scroll-mt-4 items-start gap-6 xl:grid-cols-2">{closes.map(({ context: close, title, purchases }, index) => <StatementCloseForm key={close.currency} statementId={close.statement.id} currency={close.currency} today={today}
          context={`${cardName} · corte ${formatDateShort(cutoff, today)} · ${currencyLabels[close.currency].context}`} title={title} showRate={index === 0}
          calculated={{ minimum: close.calculated.minimum.toFixed(), debt: close.calculated.debt.toFixed(), interest: close.calculated.interest.toFixed(), estimated: close.calculated.estimated }}
          bank={{ minimum: close.bank.minimum?.toFixed() ?? null, debt: close.bank.debt?.toFixed() ?? null, interest: close.bank.interest?.toFixed() ?? null, lateInterest: close.bank.lateInterest?.toFixed() ?? null, rateEa: close.bank.rateEa?.toFixed() ?? null, reconciledAt: close.bank.reconciledAt }}
          purchases={purchases} />)}</div>}
        <nav aria-label="Navegación de extractos" className="flex justify-between gap-4">
          {neighbors.previous ? <Link className="text-body underline" href={`/tarjetas/${id}/extractos/${neighbors.previous}`}>Anterior</Link> : <span />}
          {neighbors.next && <Link className="text-body underline" href={`/tarjetas/${id}/extractos/${neighbors.next}`}>Siguiente</Link>}
        </nav>
      </div>
    </>
  );
}
