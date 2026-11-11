import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { StatementControls } from "@/components/statement-controls";
import { StatementStatus } from "@/components/statement-status";
import { isValidIsoDate, todayInBogota } from "@/lib/domain/dates";
import { statementPeriod } from "@/lib/domain/statements";
import { formatDateShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Extracto" };
type Statement = { id: string; period_start: string; cutoff_date: string; due_date: string; paid_at: string | null; real_total: string | null };
type Movement = { id: string; type: string; source: string; merchant: string | null; date: string; currency: "COP" | "USD"; amount: string; amount_cop: string; installments_count: number };
type Installment = { transaction_id: string; number: number; total: string; total_cop: string };
type Totals = { single_purchases: string; installments: string; subscriptions: string; cash_advances: string; interest: string; handling_fees: string; insurance: string; adjustments: string; refunds: string; payments: string; total_calculated: string };
const groups = [ ["single_purchases", "Compras"], ["installments", "Cuotas"], ["subscriptions", "Suscripciones"], ["cash_advances", "Avances y comisiones"], ["interest", "Intereses"], ["handling_fees", "Cuota de manejo"], ["insurance", "Seguros"], ["adjustments", "Ajustes"], ["refunds", "Devoluciones"] ] as const;
function movementGroup(movement: Movement): keyof Totals | null {
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

export default async function StatementDetailPage({ params }: { params: Promise<{ id: string; cutoff: string }> }) {
  const { id, cutoff } = await params;
  if (!z.uuid().safeParse(id).success || !isValidIsoDate(cutoff)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [cardResult, statementResult, neighborsResult] = await Promise.all([
    supabase.from("cards").select("id,name,cutoff_day,payment_day").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("statements").select("id,period_start,cutoff_date,due_date,paid_at,real_total::text").eq("card_id", id).eq("user_id", user.id).eq("cutoff_date", cutoff).maybeSingle(),
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
  let totals: Totals | null = null;
  let movements: Movement[] = [];
  let installments: Installment[] = [];
  let parents: Movement[] = [];
  if (statement) {
    const [totalsResult, movementsResult, installmentsResult] = await Promise.all([
      supabase.from("statement_totals").select("single_purchases::text,installments::text,subscriptions::text,cash_advances::text,interest::text,handling_fees::text,insurance::text,adjustments::text,refunds::text,payments::text,total_calculated::text").eq("statement_id", statement.id).eq("user_id", user.id).maybeSingle(),
      supabase.from("transactions").select("id,type,source,merchant,date,currency,amount::text,amount_cop::text,installments_count").eq("statement_id", statement.id).eq("user_id", user.id).order("date"),
      supabase.from("installments").select("transaction_id,number,total::text,total_cop::text").eq("statement_id", statement.id).eq("user_id", user.id).order("number"),
    ]);
    if (totalsResult.error || movementsResult.error || installmentsResult.error) throw new Error("No pudimos consultar los movimientos del extracto.");
    if (!totalsResult.data) throw new Error("No pudimos consultar el total del extracto.");
    totals = totalsResult.data as unknown as Totals | null;
    movements = (movementsResult.data ?? []) as unknown as Movement[];
    installments = (installmentsResult.data ?? []) as unknown as Installment[];
    if (installments.length) {
      const result = await supabase.from("transactions").select("id,type,source,merchant,date,currency,amount::text,amount_cop::text,installments_count").eq("user_id", user.id).in("id", installments.map((item) => item.transaction_id));
      if (result.error) throw new Error("No pudimos consultar las compras a cuotas.");
      parents = (result.data ?? []) as unknown as Movement[];
    }
  }
  return <><PageHeader title="Extracto" subtitle={card.name} /><div className="flex max-w-2xl flex-col gap-6"><section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"><p className="text-small text-muted-foreground">Total calculado</p><Money value={totals?.total_calculated ?? "0"} currency="COP" size="lg" /><p className="text-body">{formatDateShort(statement?.period_start ?? period.periodStart, today)} – {formatDateShort(cutoff, today)} · pagas el {formatDateShort(statement?.due_date ?? period.dueDate, today)}</p>{statement && <StatementStatus dueDate={statement.due_date} paidAt={statement.paid_at} today={today} />}</section>{statement ? <><section className="flex flex-col gap-3"><h2 className="text-heading">Desglose</h2>{groups.map(([key, label]) => { const entries = movements.filter((movement) => movementGroup(movement) === key); const isInstallments = key === "installments"; return <details key={key} className="rounded-xl border border-border bg-card p-4"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-body"><span>{label}</span><span className="text-right">{key === "refunds" && "−"}<Money value={totals?.[key] ?? "0"} currency="COP" /></span></summary><ul className="flex flex-col gap-3">{entries.map((item) => <li key={item.id}><Link href={`/movimientos/${item.id}`} className="flex items-center justify-between gap-3 text-small"><span>{item.merchant || label} · {formatDateShort(item.date, today)}</span><span className="text-right">{item.currency === "USD" && <><Money value={item.amount} currency="USD" /> · estimado </>}<Money value={item.amount_cop} currency="COP" /></span></Link></li>)}{isInstallments && installments.map((item) => { const parent = parents.find((entry) => entry.id === item.transaction_id); return <li key={`${item.transaction_id}-${item.number}`}><Link href={`/movimientos/${item.transaction_id}`} className="flex items-center justify-between gap-3 text-small"><span>{parent?.merchant || "Compra"} · cuota {item.number}</span><span className="text-right">{parent?.currency === "USD" && <><Money value={item.total} currency="USD" /> · estimado </>}<Money value={item.total_cop} currency="COP" /></span></Link></li>; })}{!entries.length && (!isInstallments || !installments.length) && <li className="text-small text-muted-foreground">Sin movimientos.</li>}</ul></details>; })}</section><section className="flex flex-col gap-3"><h2 className="text-heading">Pagos</h2><p className="text-small text-muted-foreground">Los pagos se muestran aparte y no cambian el total del extracto.</p><details className="rounded-xl border border-border bg-card p-4"><summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-body"><span>Abonos</span><span className="text-right">−<Money value={totals?.payments ?? "0"} currency="COP" /></span></summary><ul className="flex flex-col gap-3">{movements.filter((item) => movementGroup(item) === "payments").map((item) => <li key={item.id}><Link href={`/movimientos/${item.id}`} className="flex items-center justify-between gap-3 text-small"><span>{item.merchant || "Pago"} · {formatDateShort(item.date, today)}</span><span className="text-right">{item.currency === "USD" && <><Money value={item.amount} currency="USD" /> · estimado </>}<Money value={item.amount_cop} currency="COP" /></span></Link></li>)}</ul></details></section><StatementControls id={statement.id} realTotal={statement.real_total} paid={!!statement.paid_at} today={today} /></> : <p className="text-body text-muted-foreground">Aún no hay movimientos en este extracto.</p>}<nav aria-label="Navegación de extractos" className="flex justify-between gap-4">{previous ? <Link className="text-body underline" href={`/tarjetas/${id}/extractos/${previous}`}>Anterior</Link> : <span />}{next && <Link className="text-body underline" href={`/tarjetas/${id}/extractos/${next}`}>Siguiente</Link>}</nav></div></>;
}
