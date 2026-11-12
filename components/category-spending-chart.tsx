"use client";

import type { ComponentProps } from "react";
import { Bar as RechartsBar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { formatCop } from "@/lib/format";

export type CategoryChartRow = { id: string; name: string; icon: string | null; amount: string };
const Bar = (props: ComponentProps<typeof RechartsBar>) => <RechartsBar {...props} isAnimationActive={false} />;

export function CategorySpendingChart({ rows }: { rows: CategoryChartRow[] }) {
  const data = rows.map((row) => ({ ...row, value: Number(row.amount) }));
  if (!rows.length) return <section className="flex flex-col gap-4"><h2 className="text-heading">Gasto por categoría</h2><EmptyState icon={Tags} text="No hay gasto en este mes." /></section>;
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-heading">Gasto por categoría</h2>
      <div className="min-w-0" style={{ height: Math.max(180, rows.length * 44) }} role="img" aria-label="Gasto por categoría">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--muted-foreground)", className: "chart-axis" }} tickFormatter={(value: number) => formatCop(String(value))} interval="preserveStartEnd" minTickGap={20} height={40} />
            <YAxis dataKey="name" type="category" width={112} tick={{ fill: "var(--muted-foreground)", className: "chart-axis" }} tickFormatter={(value: string) => value.length > 16 ? `${value.slice(0, 15)}…` : value} />
            <Tooltip content={({ active, label }) => {
              const row = rows.find((item) => item.name === String(label));
              return active && row ? <div className="rounded-md border border-border bg-popover p-4 text-small text-popover-foreground">{row.name}: <span className="text-amount">{formatCop(row.amount)}</span></div> : null;
            }} />
            <Bar dataKey="value" fill="var(--muted-foreground)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2">{rows.map((row) => {
        const Icon = row.icon && Object.hasOwn(categoryIcons, row.icon) ? categoryIcons[row.icon as CategoryIcon] : Tags;
        return <li key={row.id} className="flex justify-between gap-2 text-small"><span className="inline-flex min-w-0 items-center gap-2 break-words"><Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />{row.name}</span><span className="shrink-0 text-right text-amount">{formatCop(row.amount)}</span></li>;
      })}</ul>
    </section>
  );
}
