import Decimal from "decimal.js";
import { exchangeDifference } from "@/lib/domain/fx-difference";
import { formatMoney } from "@/lib/format";

/**
 * F23, D56: pesos paid for the dollars of a statement against the reference of each purchase. A difference is a fact, not a
 * state: it is told in neutral text either way.
 */
export function ExchangeDifference({ paidUsd, paidCop, chargesUsd, chargesCop }: { paidUsd: Decimal; paidCop: Decimal; chargesUsd: Decimal; chargesCop: Decimal }) {
  if (!paidUsd.gt(0)) return null;
  const result = exchangeDifference({ paidUsd, paidCop, chargesUsd, chargesCop });
  if (!result) return null;
  const amount = result.difference.abs().toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const outcome = amount.isZero() ? "el dólar te costó lo mismo" : `el dólar te costó ${formatMoney(amount, "COP")} ${result.difference.gt(0) ? "más" : "menos"}`;
  return <p className="text-small text-muted-foreground">Pagaste {formatMoney(paidCop, "COP")} por {formatMoney(paidUsd, "USD")}; con la TRM de cada compra eran {formatMoney(result.reference, "COP")}: {outcome}.</p>;
}
