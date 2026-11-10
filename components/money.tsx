import Decimal from "decimal.js";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/domain/money";

export function Money({ value, currency, size = "md" }: { value: string | Decimal; currency: Currency; size?: "md" | "lg" }) {
  return <span className={size === "lg" ? "text-amount-lg text-foreground" : "text-amount text-foreground"}>{formatMoney(value, currency)}</span>;
}
