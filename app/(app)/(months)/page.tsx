import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, WalletCards } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { CurrencyInline } from "@/components/currency-amounts";
import { MonthCardsStrip } from "@/components/month-cards-strip";
import { MonthRow } from "@/components/month-row";
import { NewExpenseFab } from "@/components/new-expense-fab";
import { PageHeader } from "@/components/page-header";
import { SaveNotice } from "@/components/save-notice";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { todayInBogota } from "@/lib/domain/dates";
import { historyMonthCapacity, historyMonthNextBlock } from "@/lib/domain/months";
import { formatMonth } from "@/lib/format";
import { loadMonthOverview } from "@/lib/queries/months";
import { createSupabaseMonthSource } from "@/lib/queries/supabase-months";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Meses" };

export default async function MonthsPage({ searchParams }: { searchParams: Promise<{ saved?: string; historial?: string }> }) {
  const { saved, historial } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const source = createSupabaseMonthSource(supabase, user.id);
  const today = todayInBogota();
  const [overview, cards] = await Promise.all([
    loadMonthOverview(source, today, { historySize: historyMonthCapacity(historial) }),
    source.loadCardDetails(),
  ]);
  const incomplete = [overview.current, ...overview.future, ...overview.history].some((month) => !month.complete);
  const rowProps = { cards, subscriptionNames: overview.subscriptionNames, today };
  const rowsGrid = (count: number) => count > 1 ? "grid min-w-0 gap-3 xl:grid-cols-2" : "grid min-w-0 gap-3";
  return (
    <>
      {saved === "1" && <SaveNotice />}
      <PageHeader title="Meses" subtitle="Tus tarjetas, claras antes de cada corte." action={<Link href="/movimientos/nuevo" className={buttonVariants({ className: "hidden md:inline-flex" })}><Plus aria-hidden="true" className="size-5" strokeWidth={1.75} />Nuevo gasto</Link>} />
      <div className="grid min-w-0 gap-6">
        {overview.overdue.months.size > 0 && (
          <Alert variant="destructive" role="note">
            <AlertTitle>Extractos vencidos sin confirmar pago: <CurrencyInline cop={overview.overdue.total} usd={overview.overdue.totalUsd} /></AlertTitle>
            <AlertDescription className="text-foreground">
              <p>No descuenta abonos registrados. Los extractos siguen en su mes de pago.</p>
              <div className="flex flex-wrap gap-3">{[...overview.overdue.months.keys()].sort().map((month) => <Link key={month} className="underline" href={`/meses/${month}`}>{formatMonth(month, "long")}</Link>)}</div>
            </AlertDescription>
          </Alert>
        )}
        {incomplete && <Alert variant="warning" role="note"><AlertTitle>Falta la TRM</AlertTitle><AlertDescription className="text-foreground">Los cobros en dólares se suman aparte y sus totales no cambian. Solo falta su equivalente en pesos de referencia. Para calcularlo, <Link className="underline" href="/movimientos/nuevo">registra un movimiento en USD con la TRM del día</Link>.</AlertDescription></Alert>}
        <section aria-labelledby="current-month-heading" className="grid gap-3">
          <h2 id="current-month-heading" className="text-heading">Este mes</h2>
          <MonthRow month={overview.current} {...rowProps} featured />
        </section>
        {!cards.length && <EmptyState icon={WalletCards} text="Aún no tienes tarjetas. Agrega la primera." action={<Link href="/ajustes" className="text-body underline">Ir a ajustes</Link>} />}
        {cards.length > 0 && <MonthCardsStrip cards={cards} />}
        {overview.future.length > 0 && <section aria-labelledby="future-months-heading" className="grid gap-3">
          <h2 id="future-months-heading" className="text-heading">Próximos meses</h2>
          <div className={rowsGrid(overview.future.length)}>{overview.future.map((month) => <MonthRow key={month.month} month={month} {...rowProps} />)}</div>
        </section>}
        {overview.hasLaterCommitments && <Alert role="note"><AlertDescription>Tienes compromisos posteriores a estos 12 meses.</AlertDescription></Alert>}
        {overview.history.length > 0 && <section aria-labelledby="past-months-heading" className="grid gap-3">
          <h2 id="past-months-heading" className="text-heading">Meses anteriores</h2>
          <div className={rowsGrid(overview.history.length)}>{overview.history.map((month) => <MonthRow key={month.month} month={month} {...rowProps} />)}</div>
          {overview.historyNextBefore && <Link className="w-fit rounded-md text-body underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11" href={`/?historial=${historyMonthNextBlock(historial)}#past-months-heading`}>Cargar más meses</Link>}
        </section>}
      </div>
      <NewExpenseFab />
    </>
  );
}
