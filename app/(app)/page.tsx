import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { WalletCards } from "lucide-react";
import { CardSummary } from "@/components/card-summary";
import { DashboardTotals } from "@/components/dashboard-totals";
import { EmptyState } from "@/components/empty-state";
import { NewExpenseFab } from "@/components/new-expense-fab";
import { PageHeader } from "@/components/page-header";
import { SaveNotice } from "@/components/save-notice";
import type { CardColor } from "@/lib/card-colors";
import { nextPayment, totalDueInMonth } from "@/lib/domain/dashboard";
import { addMonths, monthKey, todayInBogota } from "@/lib/domain/dates";
import { compareMonths, monthlySpending } from "@/lib/domain/totals";
import { createClient } from "@/lib/supabase/server";
import { fetchAllPages } from "@/lib/paginate";

export const metadata: Metadata = { title: "Tablero" };
type Card = { id: string; name: string; bank: string; last4: string; color: CardColor };
type Balance = { card_id: string; used: string; available: string; utilization: string };
type Statement = { id: string; card_id: string; due_date: string; paid_at: string | null };
type Total = { statement_id: string; total_calculated: string };
type Movement = { date: string; type: string; amount_cop: string };

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const today = todayInBogota();
  const month = monthKey(today);
  const previous = monthKey(addMonths(`${month}-01`, -1));
  const [cardsResult, balancesResult, statementsResult, totalsResult, movementsResult] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("cards").select("id,name,bank,last4,color").eq("user_id", user.id).is("archived_at", null).order("name").order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("card_balances").select("card_id,used::text,available::text,utilization::text").eq("user_id", user.id).order("card_id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("statements").select("id,card_id,due_date,paid_at").eq("user_id", user.id).is("paid_at", null).order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("statement_totals").select("statement_id,total_calculated::text").eq("user_id", user.id).order("statement_id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("transactions").select("date,type,amount_cop::text").eq("user_id", user.id).gte("date", `${previous}-01`).lt("date", addMonths(`${month}-01`, 1)).in("type", ["purchase", "cash_advance", "refund"]).order("id").range(from, to)),
  ]);
  const cards = cardsResult as Card[];
  const balances = balancesResult as unknown as Balance[];
  const totals = new Map((totalsResult as unknown as Total[]).map((item) => [item.statement_id, item.total_calculated]));
  const cardIds = new Set(cards.map((card) => card.id));
  const statements = (statementsResult as Statement[]).filter((item) => cardIds.has(item.card_id)).map((item) => {
    const total = totals.get(item.id);
    if (total === undefined) throw new Error("No pudimos consultar los totales de los extractos.");
    return { cardId: item.card_id, dueDate: item.due_date, paidAt: item.paid_at, total: new Decimal(total) };
  });
  const movements = (movementsResult as unknown as Movement[]).map((item) => ({ date: item.date, type: item.type, amountCop: new Decimal(item.amount_cop) }));
  const spending = monthlySpending(movements, month);
  const debt = cards.reduce((sum, card) => {
    const balance = balances.find((item) => item.card_id === card.id);
    if (!balance) throw new Error("No pudimos consultar el cupo de una tarjeta.");
    return sum.plus(balance.used);
  }, new Decimal(0));
  return <>{saved === "1" && <SaveNotice />}<PageHeader title="Tablero" subtitle="Tus tarjetas, claras antes de cada corte." /><div className="flex max-w-2xl flex-col gap-6">{cards.length ? <><DashboardTotals due={totalDueInMonth(statements, month)} debt={debt} spending={spending} change={compareMonths(spending, monthlySpending(movements, previous)).pct} /><section aria-label="Tus tarjetas" className="flex flex-col gap-4">{cards.map((card) => { const balance = balances.find((item) => item.card_id === card.id)!; const payment = nextPayment(statements.filter((item) => item.cardId === card.id)); return <CardSummary key={card.id} {...card} available={balance.available} utilization={balance.utilization} today={today} payment={payment ? { dueDate: payment.dueDate, total: payment.total.toString() } : null} />; })}</section></> : <EmptyState icon={WalletCards} text="Aún no tienes tarjetas. Agrega la primera." action={<Link href="/ajustes" className="text-body underline">Ir a ajustes</Link>} />}</div><NewExpenseFab /></>;
}
