import Decimal from "decimal.js";
import { Money } from "@/components/money";
import { installmentProgress, type InstallmentRow } from "@/lib/domain/installments";
import type { Currency } from "@/lib/domain/money";
import { formatDateShort } from "@/lib/format";

export type AmortizationItem = { number: number; cutoffDate: string; principal: string; interest: string; total: string; balanceAfter: string; principalCop: string; interestCop: string; totalCop: string };

export function AmortizationTable({ items, currency, today }: { items: AmortizationItem[]; currency: Currency; today: string }) {
  const rows: InstallmentRow[] = items.map((item) => ({ number: item.number, cutoffDate: item.cutoffDate, principal: new Decimal(item.principal), interest: new Decimal(item.interest), total: new Decimal(item.total), balanceAfter: new Decimal(item.balanceAfter), principalCop: new Decimal(item.principalCop), interestCop: new Decimal(item.interestCop), totalCop: new Decimal(item.totalCop) }));
  const progress = installmentProgress(rows, today);
  const completed = items.filter((item) => item.cutoffDate < today).length;
  return <section aria-label="Cuotas" className="flex flex-col gap-4"><h2 className="text-heading">Cuotas</h2><p className="text-body">Te faltan {items.length - completed} de {items.length} cuotas</p><p className="text-body">Capital pendiente: <Money value={progress.pendingPrincipal} currency={currency} /></p>
    <div className="hidden min-w-0 rounded-xl border border-border bg-card xl:block"><table className="w-full text-small"><thead><tr className="border-b border-border text-left"><th className="p-3">Cuota</th><th className="p-3">Corte</th><th className="p-3 text-right">Capital</th><th className="p-3 text-right">Interés</th><th className="p-3 text-right">Total</th>{currency === "USD" && <th className="p-3 text-right">Estimado COP</th>}<th className="p-3 text-right">Saldo</th></tr></thead><tbody>{items.map((item) => <tr key={item.number} className={`border-b border-border last:border-0 ${item.number === progress.current && completed < items.length ? "bg-accent" : ""}`}><th scope="row" className="p-3 text-left font-normal">{item.number}{item.number === progress.current && completed < items.length && <span className="block text-small">Cuota actual</span>}</th><td className="p-3">{formatDateShort(item.cutoffDate, today)}</td><td className="p-3 text-right"><Money value={item.principal} currency={currency} /></td><td className="p-3 text-right"><Money value={item.interest} currency={currency} /></td><td className="p-3 text-right"><Money value={item.total} currency={currency} /></td>{currency === "USD" && <td className="p-3 text-right"><Money value={item.totalCop} currency="COP" /></td>}<td className="p-3 text-right"><Money value={item.balanceAfter} currency={currency} /></td></tr>)}</tbody></table></div>
    <div className="flex min-w-0 flex-col gap-2 xl:hidden">{items.map((item) => <div key={item.number} className={`min-w-0 rounded-xl border border-border p-4 ${item.number === progress.current && completed < items.length ? "bg-accent" : "bg-card"}`}><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-body font-medium">Cuota {item.number} de {items.length}{item.number === progress.current && completed < items.length ? " · Cuota actual" : ""}</span><span className="text-small text-muted-foreground">Corte {formatDateShort(item.cutoffDate, today)}</span></div><dl className="mt-3 flex flex-col gap-2 text-small">{[
      { label: "Capital", value: item.principal, currency },
      { label: "Interés", value: item.interest, currency },
      { label: "Total", value: item.total, currency },
      ...(currency === "USD" ? [{ label: "Estimado en pesos", value: item.totalCop, currency: "COP" as const }] : []),
      { label: "Saldo", value: item.balanceAfter, currency },
    ].map((entry) => <div key={entry.label} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><dt className="min-w-0 flex-1 basis-28 text-muted-foreground">{entry.label}</dt><dd className="ml-auto min-w-0 max-w-full text-right"><Money value={entry.value} currency={entry.currency} /></dd></div>)}</dl></div>)}</div></section>;
}
