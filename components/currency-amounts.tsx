import Decimal from "decimal.js";
import { Money } from "@/components/money";

/**
 * Pesos and dollars side by side, never added together (D33). Pesos lead; when there are only dollars,
 * dollars lead instead of showing "$0" as the amount to pay.
 */
export function CurrencyAmounts({ cop, usd, size = "md" }: { cop: Decimal | string; usd: Decimal | string; size?: "md" | "lg" }) {
  const pesos = new Decimal(cop);
  const dollars = new Decimal(usd);
  if (pesos.isZero() && !dollars.isZero()) return <Money value={dollars} currency="USD" size={size} />;
  return <span className="inline-flex max-w-full flex-col">
    <Money value={pesos} currency="COP" size={size} />
    {!dollars.isZero() && <span className="text-small">y <Money value={dollars} currency="USD" /></span>}
  </span>;
}

/** Inline variant for sentences and titles: "$1.284.500 y US$ 9" (D33). */
export function CurrencyInline({ cop, usd }: { cop: Decimal | string; usd: Decimal | string }) {
  const pesos = new Decimal(cop);
  const dollars = new Decimal(usd);
  if (pesos.isZero() && !dollars.isZero()) return <Money value={dollars} currency="USD" />;
  return <>{<Money value={pesos} currency="COP" />}{!dollars.isZero() && <> y <Money value={dollars} currency="USD" /></>}</>;
}
