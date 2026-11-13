import Link from "next/link";
import { CardColorChip } from "@/components/card-color-chip";
import { CreditAvailability } from "@/components/credit-availability";
import { Money } from "@/components/money";
import { StatementStatus } from "@/components/statement-status";
import { UtilizationBar } from "@/components/utilization-bar";
import type { CardColor } from "@/lib/card-colors";
import { formatDateShort } from "@/lib/format";

type Props = { id: string; name: string; bank: string; last4: string; color: CardColor; available: string; utilization: string; today: string; payment: { dueDate: string; total: string } | null };

export function CardSummary({ id, name, bank, last4, color, available, utilization, today, payment }: Props) {
  return <Link href={`/tarjetas/${id}`} className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 wrap-anywhere focus-visible:outline-2 focus-visible:outline-ring">
    <div className="flex flex-col gap-1"><CardColorChip color={color} name={`${name} · •••• ${last4}`} /><span className="text-small text-muted-foreground">{bank}</span></div>
    {payment ? (
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 text-right">
          <span className="text-small text-muted-foreground">Próximo pago</span>
          <Money value={payment.total} currency="COP" size="lg" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-small text-muted-foreground">Pago límite {formatDateShort(payment.dueDate, today)}</span>
          <StatementStatus dueDate={payment.dueDate} paidAt={null} today={today} />
        </div>
      </div>
    ) : <p className="text-small text-muted-foreground">Sin pagos pendientes.</p>}
    <div className="mt-auto flex flex-col gap-3 border-t border-border pt-4">
      <CreditAvailability value={available} />
      <UtilizationBar percent={Number(utilization) * 100} />
    </div>
  </Link>;
}
