import type { ReactNode } from "react";
export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4 sm:items-center"><div className="min-w-0 flex-1 basis-48"><h1 className="font-display text-title break-words">{title}</h1>{subtitle && <p className="text-small break-words text-muted-foreground">{subtitle}</p>}</div>{action && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{action}</div>}</header>;
}
