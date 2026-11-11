import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Decimal from "decimal.js";
import { List } from "lucide-react";
import { CategorySpendingChart } from "@/components/category-spending-chart";
import { EmptyState } from "@/components/empty-state";
import { HistoryFilters } from "@/components/history-filters";
import { MonthlySpendingChart } from "@/components/monthly-spending-chart";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { addMonths, monthKey, todayInBogota } from "@/lib/domain/dates";
import { spendingByCategory, spendingByMonth } from "@/lib/domain/history";
import type { HistoryCard, HistoryCategory, HistoryRow } from "@/lib/history-types";
import { filterHistoryRows } from "@/lib/history-filtering";
import { fetchAllPages } from "@/lib/paginate";
import { createClient } from "@/lib/supabase/server";
import { parseHistoryFilters } from "@/lib/validation/history-filters";

export const metadata: Metadata = { title: "Movimientos" };
const PAGE_SIZE = 100;

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const today = todayInBogota();
  const filters = parseHistoryFilters(await searchParams, monthKey(today));
  const firstMonth = addMonths(`${filters.mes}-01`, -11);
  const nextMonth = addMonths(`${filters.mes}-01`, 1);
  const [cardRows, categoryRows, transactionRows] = await Promise.all([
    fetchAllPages((from, to) => supabase.from("cards").select("id,name,last4,color").eq("user_id", user.id).order("name").order("id").range(from, to)),
    fetchAllPages((from, to) => supabase.from("categories").select("id,name,icon").eq("user_id", user.id).order("name").order("id").range(from, to)),
    fetchAllPages((from, to) => {
      let query = supabase.from("transactions").select("id,date,merchant,note,type,amount::text,amount_cop::text,currency,card_id,category_id,installments_count").eq("user_id", user.id).gte("date", firstMonth).lt("date", nextMonth);
      if (filters.tarjeta) query = query.eq("card_id", filters.tarjeta);
      if (filters.categoria) query = query.eq("category_id", filters.categoria);
      return query.order("date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).range(from, to);
    }),
  ]);
  const cards = cardRows as HistoryCard[];
  const categories = categoryRows as HistoryCategory[];
  const transactions = transactionRows as unknown as HistoryRow[];
  const filtered = filterHistoryRows(transactions, filters);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.pagina, pageCount);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const chartMovements = transactions.map((item) => ({ date: item.date, type: item.type, amountCop: new Decimal(item.amount_cop), cardId: item.card_id, categoryId: item.category_id }));
  const chartCards = cards.filter((card) => (!filters.tarjeta || filters.tarjeta === card.id) && chartMovements.some((item) => item.cardId === card.id));
  const monthly = spendingByMonth(chartMovements, filters.mes).map((item) => ({ month: item.month, amounts: Object.fromEntries(Object.entries(item.cards).map(([id, value]) => [id, value.toString()])) }));
  const categoryChart = spendingByCategory(chartMovements, filters.mes).map((item) => { const category = categories.find((entry) => entry.id === item.categoryId); return { id: item.categoryId ?? "none", name: category?.name ?? "Sin categoría", icon: category?.icon ?? null, amount: item.amount.toString() }; });
  const pageUrl = (number: number) => { const params = new URLSearchParams(); for (const key of ["mes", "tarjeta", "categoria", "tipo", "q"] as const) { const value = filters[key]; if (value) params.set(key, value); } params.set("pagina", String(number)); return `/movimientos?${params}`; };
  return <><PageHeader title="Movimientos" subtitle="Consulta tus gastos y pagos." /><div className="flex max-w-2xl flex-col gap-6"><HistoryFilters filters={filters} cards={cards} categories={categories} /><MonthlySpendingChart rows={monthly} cards={chartCards} /><CategorySpendingChart rows={categoryChart} />{shown.length ? <><TransactionList rows={shown} allRows={filtered} cards={cards} categories={categories} today={today} />{pageCount > 1 && <nav aria-label="Páginas del historial" className="flex items-center justify-between gap-4 text-body">{page > 1 ? <Link className="min-h-11 underline" href={pageUrl(page - 1)}>Anterior</Link> : <span />}<span>Página {page} de {pageCount}</span>{page < pageCount ? <Link className="min-h-11 underline" href={pageUrl(page + 1)}>Siguiente</Link> : <span />}</nav>}</> : <EmptyState icon={List} text="No hay movimientos con estos filtros." action={<Link href="/movimientos" className="text-body underline">Limpiar filtros</Link>} />}</div></>;
}
