import Decimal from "decimal.js";
import { Money } from "@/components/money";
import { formatSpendingComparison } from "@/lib/format";

export function DashboardTotals({ due, debt, spending, previousSpending, previousMonth }: { due: Decimal; debt: Decimal; spending: Decimal; previousSpending: Decimal; previousMonth: string }) {
  return <section aria-label="Totales" className="flex min-w-0 flex-col gap-6 rounded-xl border border-border bg-card p-4 wrap-anywhere">
    <div className="flex flex-col gap-1"><span className="text-small text-muted-foreground">Total a pagar este mes</span><Money value={due} currency="COP" size="lg" /></div>
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-body">Deuda total pendiente</span><span className="ml-auto text-right"><Money value={debt} currency="COP" /></span></div>
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-body">Gasto del mes</span><span className="ml-auto text-right"><Money value={spending} currency="COP" /></span></div>
        <p className="text-small text-muted-foreground">{formatSpendingComparison(spending, previousSpending, previousMonth)}</p>
      </div>
    </div>
  </section>;
}
