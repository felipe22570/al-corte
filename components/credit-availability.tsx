import Decimal from "decimal.js";
import { Money } from "@/components/money";
import { formatExchangeRate } from "@/lib/format";

/** D52: how the debt in dollars was valued; only shown when the card has one. */
export type CreditFx = { usdNet: string | Decimal; rate: string | Decimal | null; estimated: boolean };

export function CreditAvailability({ value, showLabel = true, fx }: { value: string | Decimal; showLabel?: boolean; fx?: CreditFx }) {
  const available = new Decimal(value);
  const note = fx && !new Decimal(fx.usdNet).isZero()
    ? <p className="text-right text-small text-muted-foreground">{fx.estimated || fx.rate === null ? "Cupo estimado con la TRM de cada compra" : `Dólares con la TRM de ${formatExchangeRate(fx.rate)}`}</p>
    : null;
  if (available.lessThan(0)) {
    const excess = available.abs();
    const belowOnePeso = excess.lessThan(1);
    return <div className="grid min-w-0 gap-1">
      <p className="max-w-full rounded-sm bg-danger-soft px-2 py-1 text-right text-body text-danger wrap-anywhere">{belowOnePeso ? "Sobrecupo menor a " : "Sobrecupo de "}<Money value={belowOnePeso ? "1" : excess} currency="COP" tone="danger" /></p>
      {note}
    </div>;
  }
  return <div className="grid min-w-0 gap-1">
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-2">
      {showLabel && <span className="text-small text-muted-foreground">Cupo disponible</span>}
      <span className="ml-auto min-w-0 max-w-full text-right"><Money value={available} currency="COP" /></span>
    </div>
    {note}
  </div>;
}
