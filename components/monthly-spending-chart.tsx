"use client";

import type { ComponentProps } from "react";
import { Bar as RechartsBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CardColorChip } from "@/components/card-color-chip";
import { EmptyState } from "@/components/empty-state";
import { ChartColumn } from "lucide-react";
import { formatCop } from "@/lib/format";
import type { HistoryCard } from "@/lib/history-types";

export type MonthlyChartRow = { month: string; amounts: Record<string, string> };
const Bar = (props: ComponentProps<typeof RechartsBar>) => <RechartsBar {...props} isAnimationActive={false} />;

export function MonthlySpendingChart({ rows, cards }: { rows: MonthlyChartRow[]; cards: HistoryCard[] }) {
  const data = rows.map((row) => ({ month: row.month, ...Object.fromEntries(cards.map((card) => [card.id, Number(row.amounts[card.id] ?? "0")])) }));
  if (!cards.length) return <section className="flex flex-col gap-4"><h2 className="text-heading">Gasto de los últimos 12 meses</h2><EmptyState icon={ChartColumn} text="Aún no hay movimientos para mostrar." /></section>;
  return <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Gasto de los últimos 12 meses</h2><div className="h-64 min-w-0" role="img" aria-label="Gasto por mes y tarjeta"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ left: 0, right: 4 }}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: string) => value.slice(5)} interval={0} /><YAxis width={70} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => formatCop(String(value))} /><Tooltip content={({ active, label }) => { const row = rows.find((item) => item.month === String(label)); return active && row ? <div className="rounded-md border border-border bg-popover p-4 text-small text-popover-foreground"><p>{row.month}</p>{cards.map((card) => <p key={card.id}>{card.name} · •••• {card.last4}: <span className="text-amount">{formatCop(row.amounts[card.id] ?? "0")}</span></p>)}</div> : null; }} />{cards.map((card) => <Bar key={card.id} dataKey={card.id} stackId="spending" fill={`var(--${card.color})`} />)}</BarChart></ResponsiveContainer></div><div className="flex flex-wrap gap-3">{cards.map((card) => <CardColorChip key={card.id} color={card.color} name={`${card.name} · •••• ${card.last4}`} />)}</div><div className="sr-only">{rows.map((row) => <p key={row.month}>{row.month}: {cards.map((card) => `${card.name} ${formatCop(row.amounts[card.id] ?? "0")}`).join(", ")}</p>)}</div></section>;
}
