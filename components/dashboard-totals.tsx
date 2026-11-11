import Decimal from "decimal.js";
import { Money } from "@/components/money";
import { formatPercent } from "@/lib/format";

export function DashboardTotals({ due, debt, spending, change }: { due: Decimal; debt: Decimal; spending: Decimal; change: Decimal | null }) {
  return <section aria-label="Totales" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
    <div className="flex flex-col gap-1"><span className="text-small text-muted-foreground">Total a pagar este mes</span><Money value={due} currency="COP" size="lg" /></div>
    <div className="flex flex-wrap justify-between gap-2"><span className="text-body">Deuda total pendiente</span><Money value={debt} currency="COP" /></div>
    <div className="flex flex-wrap justify-between gap-2"><span className="text-body">Gasto del mes</span><Money value={spending} currency="COP" /></div>
    <p className="text-small text-muted-foreground">{change === null ? "Sin comparación con el mes anterior" : `${change.isPositive() ? "↑ " : change.isNegative() ? "↓ " : ""}${formatPercent(change.abs())} frente al mes anterior`}</p>
  </section>;
}
