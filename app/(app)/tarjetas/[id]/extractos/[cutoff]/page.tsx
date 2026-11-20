import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { z } from "zod";
import { Money } from "@/components/money";
import { CardColorChip } from "@/components/card-color-chip";
import { PageHeader } from "@/components/page-header";
import { StatementBalanceControls } from "@/components/statement-balance-controls";
import { StatementBreakdown } from "@/components/statement-breakdown";
import type { StatementConceptData } from "@/components/statement-concept";
import { StatementInterestForm } from "@/components/statement-interest-form";
import { StatementStatus } from "@/components/statement-status";
import { bankDifference } from "@/lib/domain/balances";
import { isValidIsoDate, todayInBogota } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";
import { isWithinMonthProjectionWindow, paymentMonth } from "@/lib/domain/months";
import { statementPeriod } from "@/lib/domain/statements";
import { formatDateShort, formatMoney } from "@/lib/format";
import { loadInterestEstimates, type InterestEstimate } from "@/lib/queries/interest-estimates";
import { loadPrepaidAmounts } from "@/lib/queries/prepayments";
import { loadStatementBalances, summarizeStatementBalances, type CurrencySummary, type StatementBalancesData } from "@/lib/queries/statement-balances";
import { createClient } from "@/lib/supabase/server";
import type { CardColor } from "@/lib/card-colors";

export const metadata: Metadata = { title: "Extracto" };
type Statement = { id: string; period_start: string; cutoff_date: string; due_date: string };
type Movement = { id: string; type: string; source: string; merchant: string | null; date: string; currency: Currency; amount: string; amount_cop: string; installments_count: number; prepaid?: boolean };
type Installment = { transaction_id: string; number: number; total: string; total_cop: string };
type ConceptKey = "single_purchases" | "installments" | "subscriptions" | "cash_advances" | "interest" | "handling_fees" | "insurance" | "adjustments" | "refunds" | "payments";
const groups = [ ["single_purchases", "Compras"], ["installments", "Cuotas"], ["subscriptions", "Suscripciones"], ["cash_advances", "Avances y comisiones"], ["interest", "Intereses"], ["handling_fees", "Cuota de manejo"], ["insurance", "Seguros"], ["adjustments", "Ajustes"], ["refunds", "Devoluciones"] ] as const;
const currencyLabels: Record<Currency, { title: string; breakdown: string; payments: string; context: string }> = {
  COP: { title: "En pesos", breakdown: "Desglose en pesos", payments: "Pagos en pesos", context: "pesos" },
  USD: { title: "En dólares", breakdown: "Desglose en dólares", payments: "Pagos en dólares", context: "dólares" },
};
function movementGroup(movement: Movement): ConceptKey | null {
  if (movement.installments_count > 1) return null;
  switch (movement.type) {
    case "purchase": return movement.source === "subscription" ? "subscriptions" : "single_purchases";
    case "cash_advance": case "advance_fee": return "cash_advances";
    case "interest": return "interest";
    case "handling_fee": return "handling_fees";
    case "insurance": return "insurance";
    case "adjustment": return "adjustments";
    case "refund": return "refunds";
    case "payment": return "payments";
    default: return null;
  }
}

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [cardResult, statementResult, neighborsResult] = await Promise.all([
    supabase.from("cards").select("id,name,last4,color,cutoff_day,payment_day,interest_mode,archived_at").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("statements").select("id,period_start,cutoff_date,due_date").eq("card_id", id).eq("user_id", user.id).eq("cutoff_date", cutoff).maybeSingle(),
    supabase.from("statements").select("period_start,cutoff_date").eq("card_id", id).eq("user_id", user.id).order("cutoff_date"),
  ]);
  if (cardResult.error || statementResult.error || neighborsResult.error) throw new Error("No pudimos consultar el extracto.");
  if (!cardResult.data) notFound();
  const today = todayInBogota();
  const card = cardResult.data;
  const period = statementPeriod({ cutoffDay: card.cutoff_day, paymentDay: card.payment_day }, today);
  const statement = statementResult.data as unknown as Statement | null;
  if (!statement && cutoff !== period.cutoffDate) notFound();
  const savedStatements = neighborsResult.data ?? [];
  const openCutoff = savedStatements.find((item) => item.period_start <= today && today <= item.cutoff_date)?.cutoff_date ?? period.cutoffDate;
  const neighbors = [...new Set([...savedStatements.map((item) => item.cutoff_date), openCutoff])].sort();
  const previous = neighbors.filter((item) => item < cutoff).at(-1);
  const next = neighbors.find((item) => item > cutoff);
  let movements: Movement[] = [];
  let installments: Installment[] = [];
  let parents: Movement[] = [];
  let balances: StatementBalancesData | undefined;
  // D32: without a registered interest charge, an on-balance statement carries the R8 estimate in its minimum payment.
  const onBalance = card.interest_mode === "on_balance";
  let estimate: InterestEstimate | undefined;
  let latestRate: string | null = null;
  // D37: payments registered for this statement, wherever their date places them (R1).
  const paidFor: Partial<Record<Currency, Decimal>> = {};
  if (statement) {
    const [movementsResult, installmentsResult, balancesByStatement, paidForResult] = await Promise.all([
      supabase.from("transactions").select("id,type,source,merchant,date,currency,amount::text,amount_cop::text,installments_count").eq("statement_id", statement.id).eq("user_id", user.id).order("date"),
      supabase.from("installments").select("transaction_id,number,total::text,total_cop::text").eq("statement_id", statement.id).eq("user_id", user.id).order("number"),
      loadStatementBalances(supabase, user.id, [statement.id]),
      supabase.from("transactions").select("currency,amount::text").eq("paid_statement_id", statement.id).eq("user_id", user.id).eq("type", "payment"),
    ]);
    if (movementsResult.error || installmentsResult.error || paidForResult.error) throw new Error("No pudimos consultar los movimientos del extracto.");
    movements = (movementsResult.data ?? []) as unknown as Movement[];
    for (const payment of (paidForResult.data ?? []) as unknown as Array<{ currency: Currency; amount: string }>) paidFor[payment.currency] = (paidFor[payment.currency] ?? new Decimal(0)).plus(payment.amount);
    // R9: a single-installment charge shows what is left after its prepayments, as the statement totals do.
    const singles = movements.filter((item) => item.installments_count === 1 && item.type !== "payment" && item.type !== "refund");
    const prepaid = singles.length ? await loadPrepaidAmounts(supabase, user.id, singles.map((item) => item.id)) : new Map();
    movements = movements.map((item) => {
      const applied = item.installments_count === 1 ? prepaid.get(item.id) : undefined;
      return applied ? { ...item, prepaid: true, amount: new Decimal(item.amount).minus(applied.amount).toFixed(), amount_cop: new Decimal(item.amount_cop).minus(applied.amountCop).toFixed() } : item;
    });
    installments = (installmentsResult.data ?? []) as unknown as Installment[];
    balances = balancesByStatement.get(statement.id);
    if (installments.length) {
      const result = await supabase.from("transactions").select("id,type,source,merchant,date,currency,amount::text,amount_cop::text,installments_count").eq("user_id", user.id).in("id", installments.map((item) => item.transaction_id));
      if (result.error) throw new Error("No pudimos consultar las compras a cuotas.");
      parents = (result.data ?? []) as unknown as Movement[];
    }
    if (onBalance) {
      const [estimates, rate] = await Promise.all([
        loadInterestEstimates(supabase, user.id, [statement]),
        supabase.from("fx_rates").select("usd_cop::text").order("date", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (rate.error) throw new Error("No pudimos consultar la última TRM.");
      estimate = estimates.get(statement.id);
      latestRate = (rate.data as { usd_cop: string } | null)?.usd_cop ?? null;
    }
  }
  const { summaries, paidAt } = summarizeStatementBalances(balances, estimate);
  const [cop, usd] = [summaries.find((item) => item.currency === "COP")!, summaries.find((item) => item.currency === "USD")];
  // D33: pesos lead; a statement with charges only in dollars leads with dollars instead of "$0".
  const headline = !cop.hasCharges && usd?.hasCharges ? usd : cop;
  const secondary = headline === cop && usd?.hasCharges ? usd : null;
  const hasRealInterest = movements.some((item) => item.type === "interest");
  const cardName = `${card.name} · •••• ${card.last4}`;
  const movementEntry = (item: Movement, fallback: string): StatementConceptData["entries"][number] => ({
    id: item.id,
    href: `/movimientos/${item.id}`,
    description: `${item.merchant || fallback} · ${formatDateShort(item.date, today)}${item.prepaid ? " · con abono a capital" : ""}`,
    amountCop: item.amount_cop,
    amountUsd: item.currency === "USD" ? item.amount : undefined,
  });
  // Currencies with charges; pesos when there are none yet.
  const visible = summaries.filter((summary) => summary.hasCharges || (summary.currency === "COP" && !summaries.some((item) => item.hasCharges)));
  const breakdowns = visible.map((summary) => {
    const totals = balances?.totals[summary.currency];
    const estimated = summary.estimatedInterest.gt(0);
    const inCurrency = movements.filter((item) => item.currency === summary.currency);
    const concepts: StatementConceptData[] = groups.map(([key, label]) => ({
      key,
      label: key === "interest" && estimated ? "Intereses estimados" : label,
      currency: summary.currency,
      total: key === "interest" && estimated ? summary.estimatedInterest.toFixed() : totals?.[key] ?? "0",
      subtract: key === "refunds",
      entries: key === "installments"
        ? installments.flatMap((item) => {
            const parent = parents.find((entry) => entry.id === item.transaction_id);
            if ((parent?.currency ?? "COP") !== summary.currency) return [];
            return [{
              id: `${item.transaction_id}-${item.number}`,
              href: `/movimientos/${item.transaction_id}`,
              description: `${parent?.merchant || "Compra"} · Cuota ${item.number}${parent ? ` de ${parent.installments_count}` : ""}`,
              amountCop: item.total_cop,
              amountUsd: summary.currency === "USD" ? item.total : undefined,
            }];
          })
        : inCurrency.filter((item) => movementGroup(item) === key).map((item) => movementEntry(item, label)),
    }));
    const payments: StatementConceptData = {
      key: "payments", label: "Abonos", currency: summary.currency, total: totals?.payments ?? "0", subtract: true,
      entries: inCurrency.filter((item) => movementGroup(item) === "payments").map((item) => movementEntry(item, "Pago")),
    };
    return { summary, concepts, payments };
  });
  const several = breakdowns.length > 1;

  return (
    <>
      <PageHeader title="Extracto" subtitle={<CardColorChip color={card.color as CardColor} name={cardName} />} />
      <div className="flex flex-col gap-6">
        <section className="flex flex-col items-start gap-3">
          <h2 className="text-heading">Pago mínimo</h2>
          <Money value={headline.minimum} currency={headline.currency} size="lg" />
          {secondary && <p className="text-body">y <Money value={secondary.minimum} currency="USD" /></p>}
          {summaries.some((summary) => summary.estimatedInterest.gt(0)) && <p className="text-small text-muted-foreground">Incluye intereses estimados</p>}
          <p className="text-body">{formatDateShort(statement?.period_start ?? period.periodStart, today)} – {formatDateShort(cutoff, today)} · pagas el {formatDateShort(statement?.due_date ?? period.dueDate, today)}</p>
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
                {summary.realMinimum && <Row label="Pago mínimo del banco"><BankValue calculated={summary.minimum} real={summary.realMinimum} currency={summary.currency} /></Row>}
                {summary.realTotal && <Row label="Deuda total del banco"><BankValue calculated={summary.debt} real={summary.realTotal} currency={summary.currency} /></Row>}
              </dl>
              <StatementBalanceControls id={statement.id} currency={summary.currency} realMinimum={summary.realMinimum?.toFixed() ?? null} realTotal={summary.realTotal?.toFixed() ?? null} paid={!!summary.paidAt} today={today} context={context} closed={cutoff < today} />
            </section>;
          })}
        </div>}
        {statement ? breakdowns.map(({ summary, concepts, payments }) => {
          const labels = currencyLabels[summary.currency];
          return <StatementBreakdown key={summary.currency} concepts={concepts} payments={payments} title={several ? labels.breakdown : "Desglose"} paymentsTitle={several ? labels.payments : "Pagos"} idSuffix={several ? `-${summary.currency.toLowerCase()}` : ""} />;
        }) : <p className="text-body text-muted-foreground">Aún no hay movimientos en este extracto.</p>}
        {statement && onBalance && !hasRealInterest && !card.archived_at && <StatementInterestForm id={statement.id} latestRate={latestRate} />}
        <nav aria-label="Navegación de extractos" className="flex justify-between gap-4">
          {previous ? <Link className="text-body underline" href={`/tarjetas/${id}/extractos/${previous}`}>Anterior</Link> : <span />}
          {next && <Link className="text-body underline" href={`/tarjetas/${id}/extractos/${next}`}>Siguiente</Link>}
        </nav>
      </div>
    </>
  );
}
