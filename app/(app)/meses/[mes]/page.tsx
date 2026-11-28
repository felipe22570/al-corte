import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { CategorySpendingChart } from "@/components/category-spending-chart";
import { CurrencyInline } from "@/components/currency-amounts";
import { Money } from "@/components/money";
import { MonthStatementCard } from "@/components/month-statement-card";
import { MonthSummary } from "@/components/month-summary";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatementCloseNotice } from "@/components/statement-close-notice";
import { todayInBogota } from "@/lib/domain/dates";
import { parsePaymentMonth, paymentMonth } from "@/lib/domain/months";
import { formatDateShort, formatMonth, formatSpendingComparison } from "@/lib/format";
import { loadMonthPage } from "@/lib/queries/month-page";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata: Metadata = { title: "Detalle del mes" };

const conceptLabels = {
  single_purchases: "Compras de una cuota", installments: "Cuotas", subscriptions: "Suscripciones",
  cash_advances: "Avances y comisiones", interest: "Intereses", handling_fees: "Cuota de manejo",
  insurance: "Seguros", adjustments: "Ajustes", refunds: "Devoluciones",
} as const;

const navLink = "inline-flex min-w-0 items-center gap-1 rounded-md text-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11";

export default async function MonthDetailPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  if (!parsePaymentMonth(mes)) notFound();
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const page = await loadMonthPage(supabase, user.id, today, mes);
  if (!page) notFound();
  const { month, previous, neighbors, overdue, subscriptionNames, toReview, cards, categories, purchases, savings, breakdown, usdBreakdown, comparison: result } = page;
  const comparison = result.kind === "comparable" && previous
    ? { text: formatSpendingComparison(month.total, previous.total, previous.month), diff: result.diff, usdDiff: result.usd?.diff ?? null } : null;
  const categoryRows = [...breakdown.categories].map(([id, amount]) => {
    const category = categories.find((item) => item.id === id);
    return { id: id ?? "uncategorized", name: category?.name ?? "Sin categoría", icon: category?.icon ?? null, amount: amount.toString() };
  });
  const totalLabel = usdBreakdown ? "Total en pesos" : "Total del mes";
  const monthName = formatMonth(mes, "name");

  return <>
    <PageHeader title={formatMonth(mes, "long")} subtitle="Mes de pago" />
    <nav aria-label="Navegación de meses" className="flex min-w-0 items-center justify-between gap-3">
      {neighbors.previous ? <Link className={navLink} href={`/meses/${neighbors.previous}`} aria-label={`Mes anterior: ${formatMonth(neighbors.previous, "long")}`}><ChevronLeft aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />{formatMonth(neighbors.previous, "long")}</Link> : <span />}
      {neighbors.next && <Link className={navLink} href={`/meses/${neighbors.next}`} aria-label={`Mes siguiente: ${formatMonth(neighbors.next, "long")}`}>{formatMonth(neighbors.next, "long")}<ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} /></Link>}
    </nav>
    {/* F15: statements of this payment month still to close against the bank. */}
    <StatementCloseNotice reviews={toReview.filter((review) => paymentMonth(review.dueDate) === mes)} cards={cards} today={today} />
    {month.kind === "current" && overdue.months.size > 0 && <Alert variant="destructive" role="note">
      <AlertTitle>Extractos vencidos sin confirmar pago: <CurrencyInline cop={overdue.total} usd={overdue.totalUsd} /></AlertTitle>
      <AlertDescription className="text-foreground"><p>No descuenta abonos registrados. Los extractos siguen en su mes de pago.</p><div className="flex flex-wrap gap-3">{[...overdue.months.keys()].sort().map((key) => <Link className="underline" key={key} href={`/meses/${key}`}>{formatMonth(key, "long")}</Link>)}</div></AlertDescription>
    </Alert>}
    <MonthSummary month={month} cards={cards} today={today} comparison={comparison} />
    {!month.complete && <Alert variant="warning" role="note"><AlertTitle>Falta la TRM</AlertTitle><AlertDescription className="text-foreground"><p>Los cobros en dólares se suman aparte y sus totales no cambian. Solo falta su equivalente en pesos de referencia. Para calcularlo, <Link className="underline" href="/movimientos/nuevo">registra un movimiento en USD con la TRM del día</Link>.</p>{month.unconvertedCharges.map((charge) => <p key={`${charge.subscriptionId}:${charge.date}`}>{subscriptionNames[charge.subscriptionId] ?? "Suscripción"} · {formatDateShort(charge.date, today)}: <Money value={charge.amountUsd} currency="USD" /></p>)}</AlertDescription></Alert>}
    <div className={month.cards.length > 0 ? "grid min-w-0 items-start gap-6 lg:grid-cols-2" : "grid min-w-0 gap-6"}>
      {month.cards.length > 0 && <section className="grid min-w-0 gap-3" aria-labelledby="statements-heading">
        <h2 id="statements-heading" className="text-heading">Extractos por tarjeta</h2>
        {month.cards.map((group) => <MonthStatementCard key={group.cardId} group={group} card={cards.find((item) => item.id === group.cardId)} today={today} savings={savings} />)}
      </section>}
      <div className="grid min-w-0 gap-6">
        <section className="grid gap-3 rounded-xl border border-border bg-card p-4" aria-labelledby="concepts-heading">
          <h2 id="concepts-heading" className="text-heading">{usdBreakdown ? "Cargos en pesos por concepto" : "Cargos por concepto"}</h2>
          <dl className="grid gap-2 text-body">
            {Object.entries(conceptLabels).map(([key, label]) => {
              const amount = breakdown.concepts[key as keyof typeof breakdown.concepts];
              return <div className={`flex justify-between gap-3 ${amount.isZero() ? "text-muted-foreground" : ""}`} key={key}><dt>{key === "interest" && breakdown.estimatedInterest ? "Intereses (incluye estimados)" : label}</dt><dd className="text-right"><Money value={amount} currency="COP" /></dd></div>;
            })}
            <div className="flex justify-between gap-3 border-t border-border pt-3 font-medium"><dt>{totalLabel}</dt><dd className="text-right"><Money value={breakdown.total} currency="COP" /></dd></div>
          </dl>
          <p className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 text-small text-muted-foreground"><span>Abonos registrados aparte, no restan del total</span><span className="whitespace-nowrap text-right"><Money value={breakdown.payments} currency="COP" /></span></p>
        </section>
        {usdBreakdown && <section className="grid gap-3 rounded-xl border border-border bg-card p-4" aria-labelledby="usd-concepts-heading">
          <h2 id="usd-concepts-heading" className="text-heading">Cargos en dólares por concepto</h2>
          <dl className="grid gap-2 text-body">
            {Object.entries(conceptLabels).flatMap(([key, label]) => {
              const amount = usdBreakdown.concepts[key as keyof typeof usdBreakdown.concepts];
              return amount.isZero() ? [] : [<div className="flex justify-between gap-3" key={key}><dt>{key === "interest" && usdBreakdown.estimatedInterest ? "Intereses (incluye estimados)" : label}</dt><dd className="text-right"><Money value={amount} currency="USD" /></dd></div>];
            })}
            <div className="flex justify-between gap-3 border-t border-border pt-3 font-medium"><dt>Total en dólares</dt><dd className="text-right"><Money value={usdBreakdown.total} currency="USD" /></dd></div>
          </dl>
          <p className="text-small text-muted-foreground">{month.complete ? <>Equivalen a unos <Money value={month.usdEquivalentCop} currency="COP" />, solo como referencia.</> : "Falta la TRM para su equivalente en pesos."}</p>
        </section>}
        <CategorySpendingChart title={usdBreakdown ? "Cargos en pesos del mes de pago por categoría" : "Cargos del mes de pago por categoría"} rows={categoryRows} total={{ label: totalLabel, amount: breakdown.total.toString() }} />
      </div>
    </div>
    <section className="grid gap-1" aria-labelledby="purchases-heading">
      <h2 id="purchases-heading" className="text-body font-medium">Compraste en {monthName}</h2>
      <p className="text-small text-muted-foreground">Según la fecha de compra, no la fecha de pago.</p>
      {purchases.isZero() ? <p className="text-small">Sin compras con fecha en {monthName}.</p> : <Money value={purchases} currency="COP" />}
    </section>
  </>;
}
