import type Decimal from "decimal.js";
import { Money } from "@/components/money";
import type { Currency } from "@/lib/domain/money";

/** F21: interest avoided by paying the total debt of a currency instead of the minimum (R11, D54). Always an estimate. */
export function PayInFullSavings({ amount, currency, currencyName }: { amount: Decimal | undefined; currency: Currency; currencyName?: string }) {
  if (!amount?.gt(0)) return null;
  return <p className="text-small text-muted-foreground">Si pagas la deuda total{currencyName ? ` en ${currencyName}` : ""} te ahorras cerca de <Money value={amount} currency={currency} /> en intereses (estimado).</p>;
}
