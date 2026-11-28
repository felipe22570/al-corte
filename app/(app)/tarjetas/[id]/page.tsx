import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Money } from "@/components/money";
import { CardColorChip } from "@/components/card-color-chip";
import { CreditAvailability } from "@/components/credit-availability";
import { PageHeader } from "@/components/page-header";
import { StatementStatus } from "@/components/statement-status";
import { UtilizationBar } from "@/components/utilization-bar";
import { todayInBogota } from "@/lib/domain/dates";
import { formatDateShort } from "@/lib/format";
import { CurrencyAmounts } from "@/components/currency-amounts";
import { loadCardDetail, type CardStatement } from "@/lib/queries/card-detail";
import { requireUser } from "@/lib/supabase/require-user";
import { StatementCloseNotice } from "@/components/statement-close-notice";

export const metadata: Metadata = { title: "Detalle de tarjeta" };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const detail = await loadCardDetail(supabase, user.id, id, today);
  if (!detail) notFound();
  const { card, balance, summaries, reviews, open, openCutoff, openDueDate, upcoming, previous, activePurchases } = detail;
  const summary = (statementId: string) => summaries.get(statementId)!;
  const statementRow = (item: CardStatement) => (
    <Link key={item.id} href={`/tarjetas/${id}/extractos/${item.cutoff_date}`} className="flex min-h-10 min-w-0 flex-wrap items-center justify-between gap-4 rounded-md py-3 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">
      <span className="flex min-w-0 flex-col gap-2"><span className="text-body">Corte {formatDateShort(item.cutoff_date, today)}</span><StatementStatus dueDate={item.due_date} paidAt={summary(item.id).paidAt} today={today} /></span>
      <span className="ml-auto flex min-w-0 max-w-full flex-col items-end text-right"><CurrencyAmounts cop={summary(item.id).cop} usd={summary(item.id).usd} />{summary(item.id).estimated && <span className="text-small text-muted-foreground">Incluye intereses estimados</span>}</span>
    </Link>
  );
  return (
    <>
      <PageHeader title={card.name} subtitle={<CardColorChip color={card.color} name={`${card.bank} · •••• ${card.last4}`} />} />
      <div className="flex min-w-0 flex-col gap-6 wrap-anywhere">
        <StatementCloseNotice reviews={reviews} cards={[{ id: card.id, name: card.name }]} today={today} />
        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-2">
          <section className="flex min-w-0 flex-col items-start gap-3">
            <h2 className="text-heading">Extracto abierto</h2>
            <CurrencyAmounts cop={open ? summary(open.id).cop : "0"} usd={open ? summary(open.id).usd : "0"} size="lg" />{open && summary(open.id).estimated && <p className="text-small text-muted-foreground">Incluye intereses estimados</p>}
            <p className="text-small text-muted-foreground">Pagas el {formatDateShort(openDueDate, today)} · corte {formatDateShort(openCutoff, today)}</p>
            <StatementStatus dueDate={openDueDate} paidAt={open ? summary(open.id).paidAt : null} today={today} />
            <Link href={`/tarjetas/${id}/extractos/${openCutoff}`} className="inline-flex min-h-10 items-center rounded-md text-body underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">Ver extracto</Link>
          </section>
          <section className="flex min-w-0 flex-col gap-4 border-t border-border pt-4 xl:border-t-0 xl:pt-0">
            <h2 className="text-heading">Cupo disponible</h2>
            <CreditAvailability value={balance.available} showLabel={false} fx={{ usdNet: balance.usdNet, rate: balance.fxRate, estimated: balance.fxEstimated }} />
            <UtilizationBar percent={Number(balance.utilization) * 100} />
          </section>
        </div>
        <section className="flex flex-col gap-3">
          <h2 className="text-heading">Próximos extractos</h2>
          {upcoming.length ? <div className="divide-y divide-border border-y border-border">{upcoming.map(statementRow)}</div> : <p className="text-small text-muted-foreground">Aún no hay próximos extractos.</p>}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-heading">Extractos anteriores</h2>
          {previous.length ? <div className="divide-y divide-border border-y border-border">{previous.map(statementRow)}</div> : <p className="text-small text-muted-foreground">Aún no hay extractos anteriores.</p>}
        </section>
        <section className="flex flex-col gap-3">
          <h2 className="text-heading">Compras a cuotas activas</h2>
          {activePurchases.length ? <div className="divide-y divide-border border-y border-border">{activePurchases.map(({ purchase, progress, currentInstallment }) => (
            <Link key={purchase.id} href={`/movimientos/${purchase.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md py-3 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="min-w-0 flex-1 basis-40"><span className="block text-body break-words">{purchase.merchant || "Compra"}</span><span className="text-small text-muted-foreground">Cuota {progress.current} de {progress.count}</span></span>
              <span className="ml-auto flex min-w-0 max-w-full flex-col gap-1 text-right"><span className="text-small">Cuota: <Money value={currentInstallment.total} currency={purchase.currency} /></span>{purchase.currency === "USD" && <span className="text-small text-muted-foreground">Estimado: <Money value={currentInstallment.totalCop} currency="COP" /></span>}<span className="text-small text-muted-foreground">Capital pendiente: <Money value={progress.pendingPrincipal} currency={purchase.currency} /></span></span>
            </Link>
          ))}</div> : <p className="text-small text-muted-foreground">No tienes compras a cuotas activas.</p>}
        </section>
      </div>
    </>
  );
}
