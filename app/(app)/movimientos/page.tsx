import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { todayInBogota } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";
import { formatDateShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Movimientos" };
export default async function MovimientosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await supabase.from("transactions").select("id,date,merchant,type,amount::text,currency").eq("user_id", user.id).is("parent_id", null).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("No pudimos consultar los movimientos.");
  const transactions = (data ?? []) as unknown as { id: string; date: string; merchant: string | null; type: string; amount: string; currency: Currency }[];
  const labels: Record<string, string> = { purchase: "Compra", cash_advance: "Avance", payment: "Pago", handling_fee: "Cuota de manejo", interest: "Interés", insurance: "Seguro", refund: "Devolución", adjustment: "Ajuste" };
  const today = todayInBogota();
  return <><PageHeader title="Movimientos" subtitle="Consulta tus gastos y pagos." />{transactions.length ? <section aria-label="Movimientos recientes" className="flex max-w-2xl flex-col gap-2"><p className="text-small text-muted-foreground">Últimos 50 movimientos. Los filtros estarán disponibles pronto.</p>{transactions.map((transaction) => <Link key={transaction.id} href={`/movimientos/${transaction.id}`} className="flex min-h-11 items-center justify-between gap-4 rounded-xl border border-border bg-card p-4"><span className="flex min-w-0 flex-col gap-1"><span className="text-body">{transaction.merchant || labels[transaction.type] || "Movimiento"}</span><span className="text-small text-muted-foreground">{formatDateShort(transaction.date, today)} · {labels[transaction.type] ?? "Movimiento"}</span></span><span className="text-right"><Money value={transaction.amount} currency={transaction.currency} /></span></Link>)}</section> : <EmptyState icon={List} text="Aún no tienes movimientos." />}</>;
}
