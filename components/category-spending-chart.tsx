"use client";

import type { ComponentProps } from "react";
import { Bar as RechartsBar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Tags } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { formatCop, formatCopCompact } from "@/lib/format";

export type CategoryChartRow = { id: string; name: string; icon: string | null; amount: string };
const Bar = (props: ComponentProps<typeof RechartsBar>) => <RechartsBar {...props} isAnimationActive={false} />;
const categoryColor = (id: string) => {
  const hash = Array.from(id).reduce((value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
  return `var(--chart-${hash % 5 + 1})`;
};

export function CategorySpendingChart({ rows }: { rows: CategoryChartRow[] }) {
  const data = rows.map((row) => ({ ...row, value: Number(row.amount), fill: categoryColor(row.id) }));
  if (!rows.length) return <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Gasto por categoría</h2><EmptyState icon={Tags} text="No hay gasto en este mes." /></section>;
  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-heading">Gasto por categoría</h2>
      <div className="min-w-0" style={{ height: Math.max(180, rows.length * 44) }} role="img" aria-label="Gasto por categoría">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
            <CartesianGrid stroke="var(--border)" horizontal={false} />
            <XAxis type="number" tick={{ fill: "var(--muted-foreground)", className: "chart-axis" }} tickFormatter={(value: number) => formatCopCompact(String(value))} interval="preserveStartEnd" minTickGap={20} height={40} />
            <YAxis dataKey="name" type="category" width={112} tick={{ fill: "var(--muted-foreground)", className: "chart-axis" }} tickFormatter={(value: string) => value.length > 16 ? `${value.slice(0, 15)}…` : value} />
            <Tooltip position={{ x: 0 }} wrapperStyle={{ maxWidth: "100%" }} content={({ active, label }) => {
              const row = rows.find((item) => item.name === String(label));
              return active && row ? <div className="max-w-[min(20rem,calc(100vw-4rem))] rounded-md border border-border bg-popover p-4 text-small wrap-anywhere text-popover-foreground">{row.name}: <span className="text-amount">{formatCop(row.amount)}</span></div> : null;
            }} />
            <Bar dataKey="value">{data.map((row) => <Cell key={row.id} fill={row.fill} />)}</Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="flex flex-col gap-2">{rows.map((row) => {
        const Icon = row.icon && Object.hasOwn(categoryIcons, row.icon) ? categoryIcons[row.icon as CategoryIcon] : Tags;
        return <li key={row.id} className="flex min-w-0 flex-wrap items-start justify-between gap-2 text-small"><span className="inline-flex min-w-0 flex-1 basis-40 items-start gap-2 wrap-anywhere"><Icon aria-hidden="true" className="size-5 shrink-0" style={{ color: categoryColor(row.id) }} strokeWidth={1.75} /><span className="min-w-0">{row.name}</span></span><span className="ml-auto min-w-0 max-w-full text-right text-amount wrap-anywhere">{formatCop(row.amount)}</span></li>;
      })}</ul>
    </section>
  );
}
