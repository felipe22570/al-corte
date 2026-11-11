import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Decimal from "decimal.js";
import { z } from "zod";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatementStatus } from "@/components/statement-status";
import { UtilizationBar } from "@/components/utilization-bar";
import type { CardColor } from "@/lib/card-colors";
import { todayInBogota } from "@/lib/domain/dates";
import { installmentProgress, type InstallmentRow } from "@/lib/domain/installments";
import { statementPeriod } from "@/lib/domain/statements";
import { formatDateShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Detalle de tarjeta" };
type Card = { id: string; name: string; bank: string; last4: string; color: CardColor; cutoff_day: number; payment_day: number };
type Statement = { id: string; period_start: string; cutoff_date: string; due_date: string; paid_at: string | null };
type Total = { statement_id: string; total_calculated: string };
type Purchase = { id: string; merchant: string | null; currency: "COP" | "USD"; installments_count: number };
type Installment = { transaction_id: string; statement_id: string; number: number; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [cardResult, balanceResult, statementResult, totalResult, purchaseResult] = await Promise.all([
    supabase.from("cards").select("id,name,bank,last4,color,cutoff_day,payment_day").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("card_balances").select("available::text,utilization::text").eq("card_id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("statements").select("id,period_start,cutoff_date,due_date,paid_at").eq("card_id", id).eq("user_id", user.id).order("cutoff_date"),
    supabase.from("statement_totals").select("statement_id,total_calculated::text").eq("card_id", id).eq("user_id", user.id),
    supabase.from("transactions").select("id,merchant,currency,installments_count").eq("card_id", id).eq("user_id", user.id).eq("type", "purchase").gt("installments_count", 1),
  ]);
  if (cardResult.error || balanceResult.error || statementResult.error || totalResult.error || purchaseResult.error) throw new Error("No pudimos consultar la tarjeta.");
  if (!cardResult.data) notFound();
  if (!balanceResult.data) throw new Error("No pudimos consultar el cupo de la tarjeta.");
  const card = cardResult.data as Card;
  const balance = balanceResult.data as unknown as { available: string; utilization: string };
  const statements = (statementResult.data ?? []) as Statement[];
  const totals = new Map(((totalResult.data ?? []) as unknown as Total[]).map((item) => [item.statement_id, item.total_calculated]));
  if (statements.some((item) => !totals.has(item.id))) throw new Error("No pudimos consultar los totales de los extractos.");
  const today = todayInBogota();
  const current = statementPeriod({ cutoffDay: card.cutoff_day, paymentDay: card.payment_day }, today);
  const open = statements.find((item) => item.period_start <= today && today <= item.cutoff_date);
  const openCutoff = open?.cutoff_date ?? current.cutoffDate;
  const upcoming = statements.filter((item) => item.cutoff_date > openCutoff);
  const previous = statements.filter((item) => item.cutoff_date < openCutoff).reverse();
  const purchases = (purchaseResult.data ?? []) as Purchase[];
  const installmentResult = purchases.length ? await supabase.from("installments").select("transaction_id,statement_id,number,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("user_id", user.id).in("transaction_id", purchases.map((purchase) => purchase.id)).order("number") : { data: [], error: null };
  if (installmentResult.error) throw new Error("No pudimos consultar las cuotas.");
  const installments = (installmentResult.data ?? []) as unknown as Installment[];
  const activePurchases = purchases.flatMap((purchase) => {
    const entries = installments.filter((item) => item.transaction_id === purchase.id).map((item): InstallmentRow => {
      const statement = statements.find((entry) => entry.id === item.statement_id);
      if (!statement) throw new Error("No pudimos consultar el corte de una cuota.");
      return { number: item.number, cutoffDate: statement.cutoff_date, principal: new Decimal(item.principal), interest: new Decimal(item.interest), total: new Decimal(item.total), balanceAfter: new Decimal(item.balance_after), principalCop: new Decimal(item.principal_cop), interestCop: new Decimal(item.interest_cop), totalCop: new Decimal(item.total_cop) };
    });
    if (!entries.length || entries.every((entry) => entry.cutoffDate < today)) return [];
    const progress = installmentProgress(entries, today);
    const currentInstallment = entries.find((entry) => entry.number === progress.current);
    return currentInstallment ? [{ purchase, progress, currentInstallment }] : [];
  });
  const statementRow = (item: Statement) => <Link key={item.id} href={`/tarjetas/${id}/extractos/${item.cutoff_date}`} className="flex min-h-11 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"><span className="flex flex-col gap-2"><span className="text-body">Corte {formatDateShort(item.cutoff_date, today)}</span><StatementStatus dueDate={item.due_date} paidAt={item.paid_at} today={today} /></span><span className="text-right"><Money value={totals.get(item.id) ?? "0"} currency="COP" /></span></Link>;
  return <><PageHeader title={card.name} subtitle={`${card.bank} · •••• ${card.last4}`} /><div className="flex max-w-2xl flex-col gap-6"><section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"><CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} /><p className="text-body">Cupo disponible: <Money value={balance.available} currency="COP" /></p><UtilizationBar percent={Number(balance.utilization) * 100} /></section><section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Extracto abierto</h2><Money value={open ? totals.get(open.id) ?? "0" : "0"} currency="COP" size="lg" /><p className="text-body">Pagas el {formatDateShort(open?.due_date ?? current.dueDate, today)} · corte {formatDateShort(openCutoff, today)}</p><StatementStatus dueDate={open?.due_date ?? current.dueDate} paidAt={open?.paid_at ?? null} today={today} /><Link href={`/tarjetas/${id}/extractos/${openCutoff}`} className="text-body underline">Ver extracto</Link></section><section className="flex flex-col gap-3"><h2 className="text-heading">Próximos extractos</h2>{upcoming.length ? upcoming.map(statementRow) : <p className="text-small text-muted-foreground">Aún no hay próximos extractos.</p>}</section><section className="flex flex-col gap-3"><h2 className="text-heading">Extractos anteriores</h2>{previous.length ? previous.map(statementRow) : <p className="text-small text-muted-foreground">Aún no hay extractos anteriores.</p>}</section><section className="flex flex-col gap-3"><h2 className="text-heading">Compras a cuotas activas</h2>{activePurchases.length ? activePurchases.map(({ purchase, progress, currentInstallment }) => <Link key={purchase.id} href={`/movimientos/${purchase.id}`} className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"><span className="text-body">{purchase.merchant || "Compra"} · cuota {progress.current}/{progress.count}</span><span className="text-small">Cuota: <Money value={currentInstallment.total} currency={purchase.currency} />{purchase.currency === "USD" && <> · estimado <Money value={currentInstallment.totalCop} currency="COP" /></>}</span><span className="text-small">Capital pendiente: <Money value={progress.pendingPrincipal} currency={purchase.currency} /></span></Link>) : <p className="text-small text-muted-foreground">No tienes compras a cuotas activas.</p>}</section></div></>;
}
