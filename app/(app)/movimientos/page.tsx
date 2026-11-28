import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { HistoryFilters } from "@/components/history-filters";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { todayInBogota } from "@/lib/domain/dates";
import { paymentMonth } from "@/lib/domain/months";
import { loadHistory } from "@/lib/queries/history";
import { requireUser } from "@/lib/supabase/require-user";
import { parseHistoryFilters } from "@/lib/validation/history-filters";

export const metadata: Metadata = { title: "Movimientos" };

export default async function MovimientosPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const filters = parseHistoryFilters(await searchParams, paymentMonth(today));
  const { cards, categories, filtered, shown, page, pageCount, hasFilters } = await loadHistory(supabase, user.id, filters);
  const pageUrl = (number: number) => { const params = new URLSearchParams(); for (const key of ["mes", "tarjeta", "categoria", "tipo", "q"] as const) { const value = filters[key]; if (value) params.set(key, value); } params.set("pagina", String(number)); return `/movimientos?${params}`; };
  return (
    <>
      <PageHeader title="Movimientos" subtitle="Consulta tus gastos y pagos." />
      <div className="flex flex-col gap-6">
        <HistoryFilters filters={filters} cards={cards} categories={categories} count={filtered.length} />
        {shown.length ? <>
          <TransactionList rows={shown} allRows={filtered} cards={cards} categories={categories} today={today} />
          {pageCount > 1 && <nav aria-label="Páginas del historial" className="flex items-center justify-between gap-4 text-body">{page > 1 ? <Link className="min-h-11 underline" href={pageUrl(page - 1)}>Anterior</Link> : <span />}<span>Página {page} de {pageCount}</span>{page < pageCount ? <Link className="min-h-11 underline" href={pageUrl(page + 1)}>Siguiente</Link> : <span />}</nav>}
        </> : <EmptyState icon={List} text={hasFilters ? "No hay movimientos con estos filtros." : "No tienes movimientos en este mes."} action={hasFilters ? <Link href="/movimientos" className="text-body underline">Limpiar filtros</Link> : <Link href={cards.length ? "/movimientos/nuevo" : "/ajustes"} className="text-body underline">{cards.length ? "Registrar movimiento" : "Agregar una tarjeta"}</Link>} />}
      </div>
    </>
  );
}
