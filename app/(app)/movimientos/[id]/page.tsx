import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AmortizationTable, type AmortizationItem } from "@/components/amortization-table";
import { CardColorChip } from "@/components/card-color-chip";
import { DeleteTransactionButton } from "@/components/delete-transaction-button";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import type { CardColor } from "@/lib/card-colors";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { todayInBogota } from "@/lib/domain/dates";
import { isWithinMonthProjectionWindow, paymentMonth } from "@/lib/domain/months";
import type { Currency } from "@/lib/domain/money";
import { formatDateShort, formatExchangeRate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detalle del movimiento" };
const typeLabels: Record<string, string> = { purchase: "Compra", cash_advance: "Avance", advance_fee: "Comisión por avance", payment: "Pago", handling_fee: "Cuota de manejo", interest: "Interés", late_interest: "Interés de mora", insurance: "Seguro", refund: "Devolución", adjustment: "Ajuste" };
const paymentKindLabels: Record<string, string> = { minimum: "Pago mínimo", total: "Pago total", other: "Otro valor" };
const effectLabels: Record<string, string> = { reduce_term: "reduce el plazo", reduce_installment: "reduce la cuota" };
type RawPrepayment = { id: string; payment_id: string | null; statement_id: string | null; transaction_id: string; amount: string; effect: string; assumed: boolean; bank_balance: string | null };
const sourceLabels: Record<string, string> = { manual: "Manual", subscription: "Suscripción", import: "Importado", email: "Correo", system: "Sistema" };
type RawTransaction = { id: string; card_id: string; category_id: string | null; statement_id: string; parent_id: string | null; subscription_id: string | null; type: string; date: string; merchant: string | null; note: string | null; currency: Currency; amount: string; amount_cop: string; fx_rate: string | null; source: string; paid_statement_id: string | null; payment_kind: string | null };
type RawInstallment = { number: number; statement_id: string | null; before_tracking: boolean; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("transactions").select("id,card_id,category_id,statement_id,parent_id,subscription_id,type,date,merchant,note,currency,amount::text,amount_cop::text,fx_rate::text,source,paid_statement_id,payment_kind").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("No pudimos consultar el movimiento.");
  if (!data) notFound();
  const transaction = data as unknown as RawTransaction;
  const [cardResult, categoryResult, installmentResult, statementsResult, childrenResult, prepaymentsResult] = await Promise.all([
    supabase.from("cards").select("name,last4,color").eq("id", transaction.card_id).eq("user_id", user.id).single(),
    transaction.category_id ? supabase.from("categories").select("name,icon").eq("id", transaction.category_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("installments").select("number,statement_id,before_tracking,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("transaction_id", id).eq("user_id", user.id).order("number"),
    supabase.from("statements").select("id,cutoff_date,due_date").eq("card_id", transaction.card_id).eq("user_id", user.id),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("parent_id", id).eq("user_id", user.id),
    supabase.from("principal_prepayments").select("id,payment_id,statement_id,transaction_id,amount::text,effect,assumed,bank_balance::text").eq("user_id", user.id).or(`transaction_id.eq.${id},payment_id.eq.${id}`).order("created_at"),
  ]);
  if (cardResult.error || categoryResult.error || installmentResult.error || statementsResult.error || childrenResult.error || prepaymentsResult.error) throw new Error("No pudimos consultar los detalles del movimiento.");
  const card = cardResult.data as { name: string; last4: string; color: CardColor };
  const category = categoryResult.data as { name: string; icon: string } | null;
  const Icon = category && Object.hasOwn(categoryIcons, category.icon) ? categoryIcons[category.icon as CategoryIcon] : null;
  const statements = new Map((statementsResult.data ?? []).map((statement) => [statement.id, statement]));
  const savedStatement = statements.get(transaction.statement_id);
  if (!savedStatement) throw new Error("No pudimos consultar el extracto del movimiento.");
  const cutoff = savedStatement.cutoff_date;
  const items: AmortizationItem[] = ((installmentResult.data ?? []) as unknown as RawInstallment[]).map((item) => {
    const installmentStatement = item.before_tracking || item.statement_id === null ? null : statements.get(item.statement_id);
    if (installmentStatement === undefined) throw new Error("No pudimos consultar el extracto de una cuota.");
    return { number: item.number, cutoffDate: installmentStatement?.cutoff_date ?? null, beforeTracking: item.before_tracking, principal: item.principal, interest: item.interest, total: item.total, balanceAfter: item.balance_after, principalCop: item.principal_cop, interestCop: item.interest_cop, totalCop: item.total_cop };
  });
  // R9: prepayments this movement received, or the ones this payment made.
  const prepayments = (prepaymentsResult.data ?? []) as unknown as RawPrepayment[];
  const counterpartIds = [...new Set(prepayments.flatMap((item) => item.payment_id === id ? [item.transaction_id] : item.payment_id ? [item.payment_id] : []))];
  const counterpartsResult = counterpartIds.length ? await supabase.from("transactions").select("id,merchant,date,type,installments_count").eq("user_id", user.id).in("id", counterpartIds) : { data: [], error: null };
  if (counterpartsResult.error) throw new Error("No pudimos consultar los abonos del movimiento.");
  const counterparts = new Map(((counterpartsResult.data ?? []) as Array<{ id: string; merchant: string | null; date: string; type: string; installments_count: number }>).map((item) => [item.id, item]));
  const paidStatement = transaction.paid_statement_id ? statements.get(transaction.paid_statement_id) : undefined;
  const today = todayInBogota();
  // Late interest is registered and corrected in the statement close (D39).
  const editable = !(transaction.type === "advance_fee" && transaction.parent_id) && transaction.type !== "late_interest";
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
        {prepayments.length > 0 && <section aria-labelledby="prepayments-title" className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <h2 id="prepayments-title" className="text-heading">{transaction.type === "payment" ? "Abonos a capital de este pago" : prepayments.some((item) => item.statement_id) ? "Abonos y saldos del banco" : "Abonos a capital"}</h2>
          <ul className="grid gap-3">{prepayments.map((item) => {
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
        {items.length > 0 && <AmortizationTable items={items} currency={transaction.currency} today={today} />}
        {editable && <DeleteTransactionButton id={id} installments={items.length} childrenCount={childrenResult.count ?? 0} prepayments={prepayments.filter((item) => item.payment_id === id).length} />}
      </div>
    </>
  );
}
