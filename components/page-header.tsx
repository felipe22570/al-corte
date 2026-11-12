import type { ReactNode } from "react";
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="font-display text-title">{title}</h1>{subtitle && <p className="text-small text-muted-foreground">{subtitle}</p>}</div>{action}</header>;
}
