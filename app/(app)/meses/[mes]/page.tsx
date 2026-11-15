import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CardColorChip } from "@/components/card-color-chip";
import { CategorySpendingChart } from "@/components/category-spending-chart";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatementPaymentControl } from "@/components/statement-payment-control";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { todayInBogota } from "@/lib/domain/dates";
import { monthBreakdown, monthComparison, parsePaymentMonth, statementKnownTotal } from "@/lib/domain/months";
import { formatCop, formatDateShort, formatMonth } from "@/lib/format";
import { loadMonthDetail } from "@/lib/queries/months";
import { createSupabaseMonthSource } from "@/lib/queries/supabase-months";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detalle del mes" };

const statuses = {
  overdue: { text: "Vencido", tone: "danger" },
  pending: { text: "Pendiente", tone: "neutral" },
  paid: { text: "Pagado", tone: "ok" },
  estimated: { text: "Estimado", tone: "neutral" },
  virtual: { text: "Previsto", tone: "neutral" },
} as const;

const conceptLabels = {
  single_purchases: "Compras de una cuota", installments: "Cuotas", subscriptions: "Suscripciones",
  cash_advances: "Avances y comisiones", interest: "Intereses", handling_fees: "Cuota de manejo",
  insurance: "Seguros", adjustments: "Ajustes", refunds: "Devoluciones", payments: "Abonos",
} as const;

export default async function MonthDetailPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  if (!parsePaymentMonth(mes)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const source = createSupabaseMonthSource(supabase, user.id);
  const today = todayInBogota();
  const detail = await loadMonthDetail(source, today, mes);
  if (!detail) notFound();
  const [cards, categories, purchases] = await Promise.all([
    source.loadCardDetails(), source.loadCategories(), source.loadPurchaseMonthSpending(mes),
  ]);
  const { month, previous, neighbors, overdue, subscriptionNames } = detail;
  const breakdown = monthBreakdown(month.statements);
  const comparison = monthComparison(month, previous);
  const categoryRows = [...breakdown.categories].map(([id, amount]) => {
    const category = categories.find((item) => item.id === id);
    return { id: id ?? "uncategorized", name: category?.name ?? "Sin categoría", icon: category?.icon ?? null, amount: amount.toString() };
  });
  const status = month.status ? statuses[month.status] : null;

  return <>
    <PageHeader title={formatMonth(mes, "long")} subtitle="Mes de pago" />
    <nav aria-label="Navegación de meses" className="flex flex-wrap justify-between gap-3 text-body">
      {neighbors.previous ? <Link className="underline" href={`/meses/${neighbors.previous}`}>Anterior: {formatMonth(neighbors.previous, "long")}</Link> : <span />}
      {neighbors.next && <Link className="underline" href={`/meses/${neighbors.next}`}>Siguiente: {formatMonth(neighbors.next, "long")}</Link>}
    </nav>
    {month.kind === "current" && overdue.months.size > 0 && <Alert variant="destructive">
      <AlertTitle>Extractos vencidos sin confirmar pago: <Money value={overdue.total} currency="COP" /></AlertTitle>
      <AlertDescription><p>No descuenta abonos registrados. Los extractos siguen en su mes de pago.</p><div className="flex flex-wrap gap-3">{[...overdue.months.keys()].sort().map((key) => <Link className="underline" key={key} href={`/meses/${key}`}>{formatMonth(key, "long")}</Link>)}</div></AlertDescription>
    </Alert>}
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4" aria-label="Resumen del mes">
      {status ? <StatusBadge text={status.text} tone={status.tone} /> : <p className="text-small">Sin extractos</p>}
      <div><p className="text-small text-muted-foreground">{month.complete ? "Total del mes" : "Total conocido"}</p><Money value={month.total} currency="COP" size="lg" />{month.total.isNegative() && <p className="text-small">Saldo a favor</p>}</div>
      {month.statements.some((statement) => statement.origin === "real") && <div><p className="text-small">Pendiente de confirmar pago: <Money value={month.pendingConfirmation} currency="COP" /></p><p className="text-small text-muted-foreground">Suma de extractos sin marcar como pagados. No descuenta abonos registrados.</p></div>}
      {month.hasProjection && <p className="text-small">Cobros previstos{!month.complete && month.projected.isZero() ? ": pendientes de conversión" : <>: <Money value={month.projected} currency="COP" />{!month.complete && " conocidos"}</>}</p>}
      <p className="text-small text-muted-foreground">{comparison.kind === "comparable" ? `Diferencia frente al mes anterior: ${formatCop(comparison.diff)}` : month.kind === "future" ? "Estimado" : month.hasOpenStatements ? "Mes en curso" : "Comparación no disponible"}</p>
      {month.kind === "future" && <p className="text-small">Se sumará lo que gastes antes de cada corte.</p>}
    </section>
    {!month.complete && <Alert variant="warning"><AlertTitle>Estimación incompleta</AlertTitle><AlertDescription><p>Hay cobros en USD sin convertir. <Link className="underline" href="/movimientos/nuevo">Revisa la TRM</Link>.</p>{month.unconvertedCharges.map((charge) => <p key={`${charge.subscriptionId}:${charge.date}`}>{subscriptionNames[charge.subscriptionId] ?? "Suscripción"} · {formatDateShort(charge.date, today)}: <Money value={charge.amountUsd} currency="USD" /></p>)}</AlertDescription></Alert>}
    {month.kind === "current" && month.hasOpenStatements && <section className="grid gap-2"><h2 className="text-heading">Así se compone este mes</h2><p className="text-body">Ya facturado: <Money value={month.billed} currency="COP" /></p><h3 className="text-heading">Aún puede crecer</h3><p className="text-body">Registrado en extractos abiertos: <Money value={month.openRecorded} currency="COP" /></p>{month.complete || !month.projected.isZero() ? <p className="text-body">Cobros previstos: <Money value={month.projected} currency="COP" />{!month.complete && " conocidos"}</p> : <p className="text-body">Cobros previstos pendientes de conversión</p>}</section>}
    <div className={month.cards.length > 0 ? "grid min-w-0 items-start gap-6 lg:grid-cols-2" : "grid min-w-0 gap-6"}>
    {month.cards.length > 0 && <section className="grid min-w-0 gap-3"><h2 className="text-heading">Extractos por tarjeta</h2>{month.cards.map((group) => {
      const card = cards.find((item) => item.id === group.cardId);
      const name = card ? `${card.name} · •••• ${card.last4}` : "Tarjeta";
      return <section key={group.cardId} className="grid gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">{card ? <CardColorChip color={card.color} name={name} /> : <span>{name}</span>}<Money value={group.total} currency="COP" /></div>
        {group.statements.map(({ statement, status: state }) => {
          const context = `${name} · corte ${formatDateShort(statement.cutoffDate, today)}`;
          return <div key={statement.id ?? `${group.cardId}:${statement.cutoffDate}`} className="grid gap-2 border-t border-border pt-4">
            <StatusBadge text={statuses[state].text} tone={statuses[state].tone} />
            {statement.periodStart && <p className="text-small text-muted-foreground">Compras del {formatDateShort(statement.periodStart, today)} al {formatDateShort(statement.cutoffDate, today)}</p>}
            <p className="text-small">Corte {formatDateShort(statement.cutoffDate, today)} · pago {formatDateShort(statement.dueDate, today)}</p>
            <p className="text-small">{statement.unconvertedCharges.length ? "Total conocido" : "Total del extracto"}: <Money value={statementKnownTotal(statement)} currency="COP" /></p>
            {statement.origin === "real" && <p className="text-small">Registrado: <Money value={statement.recordedTotal} currency="COP" /></p>}
            {!statement.projectedTotal.isZero() && <p className="text-small">Previsto: <Money value={statement.projectedTotal} currency="COP" /></p>}
            {statement.origin === "real" && statement.id && <><Link className="w-fit text-body underline" href={`/tarjetas/${statement.cardId}/extractos/${statement.cutoffDate}`}>Ver extracto · {context}</Link><StatementPaymentControl id={statement.id} paid={Boolean(statement.paidAt)} today={today} context={context} /></>}
          </div>;
        })}
      </section>;
    })}</section>}
    <div className="grid min-w-0 gap-6">
    <section className="grid gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Cargos por concepto</h2>{Object.entries(conceptLabels).filter(([key]) => key !== "payments").map(([key, label]) => <div className="flex justify-between gap-3 text-body" key={key}><span>{label}</span><Money value={breakdown.concepts[key as keyof typeof breakdown.concepts]} currency="COP" /></div>)}<div className="flex justify-between gap-3 border-t border-border pt-3 text-body"><span>Abonos registrados aparte</span><Money value={breakdown.payments} currency="COP" /></div></section>
    <CategorySpendingChart title="Cargos del mes de pago por categoría" rows={categoryRows} />
    </div>
    </div>
    <section className="grid gap-2"><h2 className="text-heading">Compraste en este mes</h2><p className="text-small text-muted-foreground">Según la fecha de compra, no la fecha de pago.</p><Money value={purchases} currency="COP" /></section>
  </>;
}
