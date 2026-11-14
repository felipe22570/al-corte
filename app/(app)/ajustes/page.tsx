import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, CreditCard, Tags } from "lucide-react";
import { ArchiveButton } from "@/components/archive-button";
import { CardColorChip } from "@/components/card-color-chip";
import { CardForm } from "@/components/card-form";
import { CategoryForm } from "@/components/category-form";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { PageHeader } from "@/components/page-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { signOut } from "@/lib/actions/auth";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { type CardColor } from "@/lib/card-colors";
import { formatRate } from "@/lib/format";
import type { CardRecord, CategoryRecord } from "@/lib/settings-types";
import { createClient } from "@/lib/supabase/server";
import { EXPORT_TABLES } from "@/lib/export-schema";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: "Ajustes" };

type RawCard = {
  id: string; name: string; bank: string; network: string; last4: string; color: CardColor; archived_at: string | null;
  credit_limit: string; advance_fee: string; handling_fee: string; cutoff_day: number; payment_day: number;
  purchase_rate_ea: string; advance_rate_ea: string; amortization_method: "fixed_principal" | "french";
};
type RawCategory = { id: string; name: string; icon: string; archived_at: string | null };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [cardResult, categoryResult] = await Promise.all([
    supabase.from("cards").select("id,name,bank,network,last4,color,archived_at,credit_limit::text,advance_fee::text,handling_fee::text,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,amortization_method").eq("user_id", user.id).order("name"),
    supabase.from("categories").select("id,name,icon,archived_at").eq("user_id", user.id).order("name"),
  ]);
  if (cardResult.error || categoryResult.error) throw new Error("No fue posible cargar los ajustes.");

  const cards: CardRecord[] = ((cardResult.data ?? []) as RawCard[]).map((card) => ({
    id: card.id, name: card.name, bank: card.bank, network: card.network, last4: card.last4, color: card.color, archivedAt: card.archived_at,
    creditLimit: card.credit_limit, advanceFee: card.advance_fee, handlingFee: card.handling_fee,
    cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea,
    advanceRateEa: card.advance_rate_ea, amortizationMethod: card.amortization_method,
  }));
  const categories: CategoryRecord[] = ((categoryResult.data ?? []) as RawCategory[]).map((category) => ({ id: category.id, name: category.name, icon: category.icon, archivedAt: category.archived_at }));
  const activeCards = cards.filter((card) => !card.archivedAt);
  const archivedCards = cards.filter((card) => card.archivedAt);
  const activeCategories = categories.filter((category) => !category.archivedAt);
  const usedColors = activeCards.map((card) => card.color);

  return <>
    <PageHeader title="Ajustes" subtitle="Administra tus tarjetas y categorías." />
    <section className="flex flex-col gap-4" aria-labelledby="cards-title">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="cards-title" className="text-heading">Tarjetas</h2><CardForm usedColors={usedColors} /></div>
      {activeCards.length === 0 ? <EmptyState icon={CreditCard} text="Aún no tienes tarjetas. Agrega la primera." /> : (
        <ul className="divide-y divide-border border-y border-border">
          {activeCards.map((card) => (
            <li key={card.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <Link href={`/tarjetas/${card.id}`} className="inline-flex min-h-10 max-w-full items-center rounded-md wrap-anywhere underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"><CardColorChip color={card.color} name={card.name} /></Link>
                <p className="text-small break-words text-muted-foreground">{card.bank} · {card.network} · •••• {card.last4}</p>
                <p className="text-small text-muted-foreground">Corte el {card.cutoffDay} · Pago el {card.paymentDay} · Compras: {formatRate(card.purchaseRateEa)}</p>
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
                <div className="text-right"><p className="text-small text-muted-foreground">Cupo total</p><Money value={card.creditLimit} currency="COP" /></div>
                <div className="flex gap-2"><CardForm card={card} usedColors={usedColors} /><ArchiveButton id={card.id} kind="card" name={card.name} /></div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {archivedCards.length > 0 && <Disclosure><DisclosureSummary><span>Tarjetas archivadas ({archivedCards.length})</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary><DisclosureContent><ul className="flex flex-col gap-4">{archivedCards.map((card) => <li key={card.id} className="flex flex-wrap items-center justify-between gap-4"><CardColorChip color={card.color} name={`${card.name} · •••• ${card.last4}`} /><ArchiveButton id={card.id} kind="card" name={card.name} archived /></li>)}</ul></DisclosureContent></Disclosure>}
    </section>
    <section className="flex flex-col gap-4" aria-labelledby="categories-title">
      <div className="flex flex-wrap items-center justify-between gap-4"><h2 id="categories-title" className="text-heading">Categorías</h2><CategoryForm /></div>
      {activeCategories.length === 0 ? <EmptyState icon={Tags} text="Aún no tienes categorías. Agrega la primera." /> : <ul className="divide-y divide-border border-y border-border">{activeCategories.map((category) => { const Icon = Object.hasOwn(categoryIcons, category.icon) ? categoryIcons[category.icon as CategoryIcon] : categoryIcons.ellipsis; return <li key={category.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2"><span className="flex min-w-0 flex-1 basis-48 items-center gap-3 text-body"><Icon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" /><span className="min-w-0 wrap-anywhere">{category.name}</span></span><div className="ml-auto flex gap-2"><CategoryForm category={category} /><ArchiveButton id={category.id} kind="category" name={category.name} /></div></li>; })}</ul>}
    </section>
    <section aria-labelledby="appearance-title" className="flex flex-col gap-4">
      <h2 id="appearance-title" className="text-heading">Apariencia</h2>
      <ThemeToggle />
    </section>
    <section className="flex flex-col gap-4" aria-labelledby="data-title">
      <h2 id="data-title" className="text-heading">Tus datos</h2>
      <p className="text-small text-muted-foreground">Descarga un respaldo JSON completo o un CSV por tabla. Los CSV conservan el texto original: revisa las fórmulas antes de abrirlos en una hoja de cálculo.</p>
      <div><a href="/ajustes/exportar?formato=json" className={buttonVariants({ variant: "outline" })}>Exportar JSON</a></div>
      <Disclosure>
        <DisclosureSummary><span>Exportar CSV</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary>
        <DisclosureContent className="flex flex-wrap gap-2">{Object.entries(EXPORT_TABLES).map(([table, config]) => <a key={table} href={`/ajustes/exportar?formato=csv&tabla=${table}`} className={buttonVariants({ variant: "outline" })}>{config.label}</a>)}</DisclosureContent>
      </Disclosure>
    </section>
    <section aria-labelledby="session-title" className="flex flex-col items-start gap-4">
      <h2 id="session-title" className="text-heading">Sesión</h2>
      <form action={signOut}><Button type="submit" variant="outline">Cerrar sesión</Button></form>
    </section>
  </>;
}
