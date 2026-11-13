import type { StatusTone } from "@/lib/ui-status";

const styles: Record<StatusTone, string> = {
  ok: "bg-primary-soft text-primary",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-secondary text-foreground",
};

export function StatusBadge({ tone, text }: { tone: StatusTone; text: string }) {
  return <span className={`inline-flex w-fit max-w-full rounded-sm px-2 py-1 text-small wrap-anywhere ${styles[tone]}`}>{text}</span>;
}
