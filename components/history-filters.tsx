import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { MonthInput } from "@/components/month-input";
import { Input } from "@/components/ui/input";
import { SelectControl } from "@/components/select-control";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { buttonVariants } from "@/components/ui/button";
import { formatMonth } from "@/lib/format";
import { historyTypeLabels, type HistoryCard, type HistoryCategory } from "@/lib/history-types";

type Filters = { mes: string; tarjeta?: string; categoria?: string; tipo?: string; q?: string };

export function HistoryFilters({ filters, cards, categories, count }: { filters: Filters; cards: HistoryCard[]; categories: HistoryCategory[]; count: number }) {
  const applied = [
    filters.tarjeta && (cards.find((card) => card.id === filters.tarjeta)?.name ?? "Tarjeta seleccionada"),
    filters.categoria && (categories.find((category) => category.id === filters.categoria)?.name ?? "Categoría seleccionada"),
    filters.tipo && historyTypeLabels[filters.tipo],
    filters.q && `Búsqueda: ${filters.q}`,
  ].filter(Boolean);
  return (
    <section aria-label="Filtros del historial" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-body font-medium">{formatMonth(filters.mes, "long")}</p>
        <p className="text-small text-muted-foreground">{count} {count === 1 ? "movimiento" : "movimientos"}</p>
      </div>
      {applied.length > 0 && <p className="break-words text-small text-muted-foreground">{applied.join(" · ")}</p>}
      <Disclosure>
        <DisclosureSummary>
          <span>Filtros{applied.length > 0 && ` (${applied.length})`}</span>
          <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
        </DisclosureSummary>
        <DisclosureContent><form action="/movimientos" className="flex flex-col gap-4">
          <p className="text-small text-muted-foreground">Los gráficos usan los filtros de mes, tarjeta y categoría. El tipo y la búsqueda filtran la lista.</p>
          <MonthInput key={filters.mes} value={filters.mes} name="mes" />
          <div className="flex flex-col gap-2 text-small"><label htmlFor="history-card">Tarjeta</label><SelectControl key={`card-${filters.tarjeta}`} id="history-card" name="tarjeta" defaultValue={filters.tarjeta ?? ""} options={[{ value: "", label: "Todas" }, ...cards.map((card) => ({ value: card.id, label: `${card.name} · •••• ${card.last4}` }))]} /></div>
          <div className="flex flex-col gap-2 text-small"><label htmlFor="history-category">Categoría</label><SelectControl key={`category-${filters.categoria}`} id="history-category" name="categoria" defaultValue={filters.categoria ?? ""} options={[{ value: "", label: "Todas" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} /></div>
          <div className="flex flex-col gap-2 text-small"><label htmlFor="history-type">Tipo</label><SelectControl key={`type-${filters.tipo}`} id="history-type" name="tipo" defaultValue={filters.tipo ?? ""} options={[{ value: "", label: "Todos" }, ...Object.entries(historyTypeLabels).map(([value, label]) => ({ value, label }))]} /></div>
          <label className="flex flex-col gap-2 text-small">Comercio o nota<Input name="q" defaultValue={filters.q} maxLength={100} /></label>
          <div className="flex flex-wrap gap-2"><button type="submit" className={buttonVariants()}>Aplicar filtros</button><Link href="/movimientos" className={buttonVariants({ variant: "outline" })}>Limpiar filtros</Link></div>
        </form></DisclosureContent>
      </Disclosure>
    </section>
  );
}
