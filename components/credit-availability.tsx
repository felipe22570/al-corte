import Decimal from "decimal.js";
import { Money } from "@/components/money";

export function CreditAvailability({ value, showLabel = true }: { value: string | Decimal; showLabel?: boolean }) {
  const available = new Decimal(value);
  if (available.lessThan(0)) {
    const excess = available.abs();
    const belowOnePeso = excess.lessThan(1);
    return <p className="max-w-full rounded-sm bg-danger-soft px-2 py-1 text-right text-body text-danger wrap-anywhere">{belowOnePeso ? "Sobrecupo menor a " : "Sobrecupo de "}<Money value={belowOnePeso ? "1" : excess} currency="COP" tone="danger" /></p>;
  }
  return <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
    {showLabel && <span className="text-small text-muted-foreground">Cupo disponible</span>}
    <span className="ml-auto min-w-0 max-w-full text-right"><Money value={available} currency="COP" /></span>
  </div>;
}
