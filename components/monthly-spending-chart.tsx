"use client";

import type { ComponentProps } from "react";
import Decimal from "decimal.js";
import { Bar as RechartsBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import { CardColorChip } from "@/components/card-color-chip";
import { EmptyState } from "@/components/empty-state";
import { formatCop, formatCopCompact, formatMonth } from "@/lib/format";
import type { HistoryCard } from "@/lib/history-types";

export type MonthlyChartRow = { month: string; amounts: Record<string, string> };
const Bar = (props: ComponentProps<typeof RechartsBar>) => <RechartsBar {...props} isAnimationActive={false} />;

export function MonthlySpendingChart({ rows, cards }: { rows: MonthlyChartRow[]; cards: HistoryCard[] }) {
  const activeCards = cards.filter((card) => rows.some((row) => !new Decimal(row.amounts[card.id] ?? "0").isZero()));
  const data = rows.map((row) => ({ month: row.month, ...Object.fromEntries(activeCards.map((card) => [card.id, Number(row.amounts[card.id] ?? "0")])) }));
  if (!activeCards.length) return <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Gasto de los últimos 12 meses</h2><EmptyState icon={ChartColumn} text="Aún no hay gasto para mostrar en este periodo." /></section>;
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-heading">Gasto de los últimos 12 meses</h2>
      <div className="h-64 min-w-0" role="img" aria-label="Gasto por mes y tarjeta">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis dataKey="month" tick={{ fill: "var(--muted-foreground)", className: "chart-axis" }} tickFormatter={(value: string) => formatMonth(value, "month-only")} interval="preserveStartEnd" minTickGap={8} height={40} />
            <YAxis width={80} tick={{ fill: "var(--muted-foreground)", className: "chart-axis" }} tickFormatter={(value: number) => formatCopCompact(String(value))} />
            <Tooltip content={({ active, label }) => {
              const row = rows.find((item) => item.month === String(label));
              return active && row ? <div className="rounded-md border border-border bg-popover p-4 text-small text-popover-foreground"><p>{formatMonth(row.month, "long")}</p>{activeCards.map((card) => <p key={card.id}>{card.name} · •••• {card.last4}: <span className="text-amount">{formatCop(row.amounts[card.id] ?? "0")}</span></p>)}</div> : null;
            }} />
            {activeCards.map((card) => <Bar key={card.id} dataKey={card.id} stackId="spending" fill={`var(--${card.color})`} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3">{activeCards.map((card) => <CardColorChip key={card.id} color={card.color} name={`${card.name} · •••• ${card.last4}`} />)}</div>
      <div className="sr-only">{rows.map((row) => <p key={row.month}>{formatMonth(row.month, "long")}: {activeCards.map((card) => `${card.name} ${formatCop(row.amounts[card.id] ?? "0")}`).join(", ")}</p>)}</div>
    </section>
  );
}
