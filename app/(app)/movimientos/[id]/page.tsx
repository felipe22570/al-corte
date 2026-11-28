import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AmortizationTable } from "@/components/amortization-table";
import { CardColorChip } from "@/components/card-color-chip";
import { DeferralCost } from "@/components/deferral-cost";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { InstallmentChangeForm, UndoInstallmentChangeButton } from "@/components/installment-change-form";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { todayInBogota } from "@/lib/domain/dates";
import { isWithinMonthProjectionWindow, paymentMonth } from "@/lib/domain/months";
import { formatDateShort, formatExchangeRate } from "@/lib/format";
import { loadTransactionDetail } from "@/lib/queries/transaction-detail";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata: Metadata = { title: "Detalle del movimiento" };
const typeLabels: Record<string, string> = { purchase: "Compra", cash_advance: "Avance", advance_fee: "Comisión por avance", payment: "Pago", handling_fee: "Cuota de manejo", interest: "Interés", late_interest: "Interés de mora", insurance: "Seguro", refund: "Devolución", adjustment: "Ajuste" };
const paymentKindLabels: Record<string, string> = { minimum: "Pago mínimo", total: "Pago total", other: "Otro valor" };
const effectLabels: Record<string, string> = { reduce_term: "reduce el plazo", reduce_installment: "reduce la cuota" };
const sourceLabels: Record<string, string> = { manual: "Manual", subscription: "Suscripción", import: "Importado", email: "Correo", system: "Sistema" };

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const detail = await loadTransactionDetail(supabase, user.id, id, today);
  if (!detail) notFound();
  const { transaction, card, category, statement: savedStatement, statements, items, prepayments, counterparts, childrenCount, paidStatement, latestChangeId, unbilled, deferral, editable } = detail;
  const Icon = category && Object.hasOwn(categoryIcons, category.icon) ? categoryIcons[category.icon as CategoryIcon] : null;
  const cutoff = savedStatement.cutoff_date;
  return (
    <>
      <PageHeader title="Detalle del movimiento" subtitle={typeLabels[transaction.type] ?? transaction.type} action={editable && <Link href={`/movimientos/${id}/editar`} className={buttonVariants({ variant: "outline" })}>Editar movimiento</Link>} />
      <div className="flex min-w-0 flex-col gap-6 wrap-anywhere">
        <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4">
          <div><p className="text-small text-muted-foreground">Valor</p><Money value={transaction.amount} currency={transaction.currency} size="lg" /></div>
          {transaction.currency === "USD" && <p className="text-body">Estimado en pesos: <Money value={transaction.amount_cop} currency="COP" /> · TRM {transaction.fx_rate && formatExchangeRate(transaction.fx_rate)}</p>}
          <dl className="grid grid-cols-1 gap-3 text-body">
            <div><dt className="text-small text-muted-foreground">Tarjeta</dt><dd><CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} /></dd></div>
            <div><dt className="text-small text-muted-foreground">Fecha</dt><dd>{formatDateShort(transaction.date, today)}</dd></div>
            <div><dt className="text-small text-muted-foreground">Corte</dt><dd><Link href={`/tarjetas/${transaction.card_id}/extractos/${cutoff}`} className="underline">{formatDateShort(cutoff, today)}</Link></dd></div>
            {isWithinMonthProjectionWindow(savedStatement.due_date, today) && <div><dt className="text-small text-muted-foreground">Mes de pago</dt><dd><Link href={`/meses/${paymentMonth(savedStatement.due_date)}`} className="underline">Ver mes de pago</Link></dd></div>}
            <div><dt className="text-small text-muted-foreground">Comercio</dt><dd>{transaction.merchant || "Sin comercio"}</dd></div>
            <div><dt className="text-small text-muted-foreground">Categoría</dt><dd className="flex min-w-0 items-start gap-2">{Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}<span className="min-w-0">{category?.name ?? "Sin categoría"}</span></dd></div>
            <div><dt className="text-small text-muted-foreground">Origen</dt><dd>{transaction.subscription_id ? <Link className="underline" href={`/suscripciones#suscripcion-${transaction.subscription_id}`}>Suscripción</Link> : sourceLabels[transaction.source] ?? transaction.source}</dd></div>
            {paidStatement && <div><dt className="text-small text-muted-foreground">Cubre el extracto</dt><dd><Link href={`/tarjetas/${transaction.card_id}/extractos/${paidStatement.cutoff_date}`} className="underline">Corte del {formatDateShort(paidStatement.cutoff_date, today)}</Link>{transaction.payment_kind && ` · ${paymentKindLabels[transaction.payment_kind]}`}</dd></div>}
            {transaction.note && <div><dt className="text-small text-muted-foreground">Nota</dt><dd className="whitespace-pre-wrap">{transaction.note}</dd></div>}
          </dl>
        </section>
        {deferral && !deferral.total.isZero() && <DeferralCost summary={deferral} currency={transaction.currency} onBalance={card.interest_mode === "on_balance"} />}
        {prepayments.length > 0 && <section aria-labelledby="prepayments-title" className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 id="prepayments-title" className="text-heading">{transaction.type === "payment" ? "Abonos a capital de este pago" : "Cambios del plan"}</h2>
          <ul className="grid gap-3">{prepayments.map((item) => {
            if (item.remaining_installments !== null) return <li key={item.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <span className="min-w-0 text-body">Cambio a {item.remaining_installments} {item.remaining_installments === 1 ? "cuota restante" : "cuotas restantes"}<span className="block text-small text-muted-foreground">Desde la próxima cuota sin facturar · {formatDateShort(item.effective_date!, today)}</span></span>
              {latestChangeId === item.id && <UndoInstallmentChangeButton changeId={item.id} />}
            </li>;
            // D39: a correction with the bank balance printed in a statement.
            const corrected = item.statement_id ? statements.get(item.statement_id) : undefined;
            if (corrected && item.bank_balance) return <li key={item.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <span className="min-w-0 text-body"><Link href={`/tarjetas/${transaction.card_id}/extractos/${corrected.cutoff_date}#cierre`} className="underline">Saldo del banco al corte del {formatDateShort(corrected.cutoff_date, today)}</Link><span className="block text-small text-muted-foreground">La compra conserva su cuota y ajusta las cuotas restantes</span></span>
              <span className="ml-auto text-right"><Money value={item.bank_balance} currency={transaction.currency} /></span>
            </li>;
            const counterpart = counterparts.get(item.payment_id === id ? item.transaction_id : item.payment_id!);
            const single = item.payment_id === id ? counterpart?.installments_count === 1 : items.length === 0;
            const label = item.payment_id === id ? counterpart?.merchant || typeLabels[counterpart?.type ?? ""] || "Compra" : `Pago del ${counterpart ? formatDateShort(counterpart.date, today) : "—"}`;
            return <li key={item.id} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
              <span className="min-w-0 text-body">{counterpart ? <Link href={`/movimientos/${counterpart.id}`} className="underline">{label}</Link> : label}<span className="block text-small text-muted-foreground">{single ? "Baja el cargo en su extracto" : `${transaction.type === "payment" ? "Abono que" : "El abono"} ${effectLabels[item.effect]}`}{item.assumed ? " · Supuesto: compra más antigua del mismo tipo" : ""}</span></span>
              <span className="ml-auto text-right"><Money value={item.amount} currency={transaction.currency} /></span>
            </li>;
          })}</ul>
        </section>}
        {/* F16: installments left can change while some are still unbilled (D40). */}
        {items.length > 1 && unbilled > 0 && <InstallmentChangeForm transactionId={id} currency={transaction.currency} remaining={unbilled} />}
        {items.length > 0 && <AmortizationTable items={items} currency={transaction.currency} today={today} />}
        {editable && <DeleteTransactionButton id={id} installments={items.length} childrenCount={childrenCount} prepayments={prepayments.filter((item) => item.payment_id === id).length} />}
      </div>
    </>
  );
}
