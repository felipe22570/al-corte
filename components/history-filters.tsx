import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { MonthInput } from "@/components/month-input";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
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
      <details className="group rounded-xl border border-border bg-card">
        <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
          <span>Filtros{applied.length > 0 && ` (${applied.length})`}</span>
          <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-muted-foreground group-open:rotate-180" strokeWidth={1.75} />
        </summary>
        <form action="/movimientos" className="flex flex-col gap-4 border-t border-border p-4">
          <p className="text-small text-muted-foreground">Los gráficos usan los filtros de mes, tarjeta y categoría. El tipo y la búsqueda filtran la lista.</p>
          <MonthInput key={filters.mes} value={filters.mes} name="mes" />
          <label className="flex flex-col gap-2 text-small">Tarjeta<NativeSelect name="tarjeta" defaultValue={filters.tarjeta ?? ""}><option value="">Todas</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name} · •••• {card.last4}</option>)}</NativeSelect></label>
          <label className="flex flex-col gap-2 text-small">Categoría<NativeSelect name="categoria" defaultValue={filters.categoria ?? ""}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</NativeSelect></label>
          <label className="flex flex-col gap-2 text-small">Tipo<NativeSelect name="tipo" defaultValue={filters.tipo ?? ""}><option value="">Todos</option>{Object.entries(historyTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</NativeSelect></label>
          <label className="flex flex-col gap-2 text-small">Comercio o nota<Input name="q" defaultValue={filters.q} maxLength={100} /></label>
          <div className="flex flex-wrap gap-2"><button type="submit" className={buttonVariants()}>Aplicar filtros</button><Link href="/movimientos" className={buttonVariants({ variant: "outline" })}>Limpiar filtros</Link></div>
        </form>
      </details>
    </section>
  );
}
