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
import type { Currency } from "@/lib/domain/money";
import { formatDateShort, formatExchangeRate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detalle del movimiento" };
const typeLabels: Record<string, string> = { purchase: "Compra", cash_advance: "Avance", advance_fee: "Comisión por avance", payment: "Pago", handling_fee: "Cuota de manejo", interest: "Interés", insurance: "Seguro", refund: "Devolución", adjustment: "Ajuste" };
const sourceLabels: Record<string, string> = { manual: "Manual", subscription: "Suscripción", import: "Importado", email: "Correo", system: "Sistema" };
type RawTransaction = { id: string; card_id: string; category_id: string | null; statement_id: string; parent_id: string | null; subscription_id: string | null; type: string; date: string; merchant: string | null; note: string | null; currency: Currency; amount: string; amount_cop: string; fx_rate: string | null; source: string };
type RawInstallment = { number: number; statement_id: string; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("transactions").select("id,card_id,category_id,statement_id,parent_id,subscription_id,type,date,merchant,note,currency,amount::text,amount_cop::text,fx_rate::text,source").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("No pudimos consultar el movimiento.");
  if (!data) notFound();
  const transaction = data as unknown as RawTransaction;
  const [cardResult, categoryResult, installmentResult, statementsResult, childrenResult] = await Promise.all([
    supabase.from("cards").select("name,last4,color").eq("id", transaction.card_id).eq("user_id", user.id).single(),
    transaction.category_id ? supabase.from("categories").select("name,icon").eq("id", transaction.category_id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    supabase.from("installments").select("number,statement_id,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("transaction_id", id).eq("user_id", user.id).order("number"),
    supabase.from("statements").select("id,cutoff_date").eq("card_id", transaction.card_id).eq("user_id", user.id),
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("parent_id", id).eq("user_id", user.id),
  ]);
  if (cardResult.error || categoryResult.error || installmentResult.error || statementsResult.error || childrenResult.error) throw new Error("No pudimos consultar los detalles del movimiento.");
  const card = cardResult.data as { name: string; last4: string; color: CardColor };
  const category = categoryResult.data as { name: string; icon: string } | null;
  const Icon = category && Object.hasOwn(categoryIcons, category.icon) ? categoryIcons[category.icon as CategoryIcon] : null;
  const statements = new Map((statementsResult.data ?? []).map((statement) => [statement.id, statement.cutoff_date]));
  const cutoff = statements.get(transaction.statement_id);
  if (!cutoff) throw new Error("No pudimos consultar el extracto del movimiento.");
  const items: AmortizationItem[] = ((installmentResult.data ?? []) as unknown as RawInstallment[]).map((item) => {
    const cutoffDate = statements.get(item.statement_id);
    if (!cutoffDate) throw new Error("No pudimos consultar el extracto de una cuota.");
    return { number: item.number, cutoffDate, principal: item.principal, interest: item.interest, total: item.total, balanceAfter: item.balance_after, principalCop: item.principal_cop, interestCop: item.interest_cop, totalCop: item.total_cop };
  });
  const today = todayInBogota();
  const editable = !(transaction.type === "advance_fee" && transaction.parent_id);
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
            <div><dt className="text-small text-muted-foreground">Comercio</dt><dd>{transaction.merchant || "Sin comercio"}</dd></div>
            <div><dt className="text-small text-muted-foreground">Categoría</dt><dd className="flex min-w-0 items-start gap-2">{Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />}<span className="min-w-0">{category?.name ?? "Sin categoría"}</span></dd></div>
            <div><dt className="text-small text-muted-foreground">Origen</dt><dd>{transaction.subscription_id ? <Link className="underline" href={`/suscripciones#suscripcion-${transaction.subscription_id}`}>Suscripción</Link> : sourceLabels[transaction.source] ?? transaction.source}</dd></div>
            {transaction.note && <div><dt className="text-small text-muted-foreground">Nota</dt><dd className="whitespace-pre-wrap">{transaction.note}</dd></div>}
          </dl>
        </section>
        {items.length > 0 && <AmortizationTable items={items} currency={transaction.currency} today={today} />}
        {editable && <DeleteTransactionButton id={id} installments={items.length} childrenCount={childrenResult.count ?? 0} />}
      </div>
    </>
  );
}
