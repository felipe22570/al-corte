import { StatusBadge } from "@/components/status-badge";
import { addDays } from "@/lib/domain/dates";

export function StatementStatus({ dueDate, paidAt, today }: { dueDate: string; paidAt: string | null; today: string }) {
  if (paidAt) return <StatusBadge tone="ok" text="Pagado" />;
  if (dueDate < today) return <StatusBadge tone="danger" text="Vencido" />;
  for (let days = 0; days <= 5; days += 1) {
    if (dueDate === addDays(today, days)) return <StatusBadge tone="warning" text={days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `Vence en ${days} días`} />;
  }
  return <StatusBadge tone="neutral" text="Pendiente" />;
}
