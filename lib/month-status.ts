import type { StatusTone } from "@/lib/ui-status";

type Label = { text: string; tone: StatusTone };

/** Month states from R7, always with text; color is never the only signal. */
export const monthStatusLabels: Record<"overdue" | "pending" | "paid" | "estimated", Label> = {
  overdue: { text: "Vencido", tone: "danger" },
  pending: { text: "Pendiente", tone: "neutral" },
  paid: { text: "Pagado", tone: "ok" },
  estimated: { text: "Estimado", tone: "neutral" },
};

/** Statement states inside a month; virtual statements are projections without payment action. */
export const statementStatusLabels: Record<"overdue" | "pending" | "paid" | "virtual", Label> = {
  overdue: monthStatusLabels.overdue,
  pending: monthStatusLabels.pending,
  paid: monthStatusLabels.paid,
  virtual: { text: "Previsto", tone: "neutral" },
};
