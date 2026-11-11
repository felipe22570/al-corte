import Link from "next/link";
import { historyTypeLabels, type HistoryCard, type HistoryCategory } from "@/lib/history-types";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";

type Filters = { mes: string; tarjeta?: string; categoria?: string; tipo?: string; q?: string };
const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-input text-foreground";

export function HistoryFilters({ filters, cards, categories }: { filters: Filters; cards: HistoryCard[]; categories: HistoryCategory[] }) {
  return <details className="rounded-xl border border-border bg-card p-4"><summary className="min-h-11 cursor-pointer text-body">Filtros</summary><form action="/movimientos" className="flex flex-col gap-4"><p className="text-small text-muted-foreground">Los gráficos usan los filtros de mes, tarjeta y categoría. El tipo y la búsqueda filtran la lista.</p>
    <label className="flex flex-col gap-2 text-small">Mes<Input type="month" name="mes" defaultValue={filters.mes} min="0002-01" max="9998-12" /></label>
    <label className="flex flex-col gap-2 text-small">Tarjeta<select className={selectClass} name="tarjeta" defaultValue={filters.tarjeta ?? ""}><option value="">Todas</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name} · •••• {card.last4}</option>)}</select></label>
    <label className="flex flex-col gap-2 text-small">Categoría<select className={selectClass} name="categoria" defaultValue={filters.categoria ?? ""}><option value="">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
    <label className="flex flex-col gap-2 text-small">Tipo<select className={selectClass} name="tipo" defaultValue={filters.tipo ?? ""}><option value="">Todos</option>{Object.entries(historyTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="flex flex-col gap-2 text-small">Comercio o nota<Input name="q" defaultValue={filters.q} maxLength={100} /></label>
    <div className="flex flex-wrap gap-2"><button type="submit" className={buttonVariants()}>Aplicar filtros</button><Link href="/movimientos" className={buttonVariants({ variant: "outline" })}>Limpiar filtros</Link></div>
  </form></details>;
}
