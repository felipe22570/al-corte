import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
export function EmptyState({ icon: Icon, text, action }: { icon: LucideIcon; text: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-4 rounded-xl border border-border p-4 text-center"><Icon className="size-5 text-muted-foreground" strokeWidth={1.75} /><p className="text-body text-muted-foreground">{text}</p>{action}</div>;
}
