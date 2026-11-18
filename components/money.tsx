import Decimal from "decimal.js";
import { formatMoney } from "@/lib/format";
import type { Currency } from "@/lib/domain/money";

export function Money({ value, currency, size = "md", tone = "default" }: { value: string | Decimal; currency: Currency; size?: "md" | "lg"; tone?: "default" | "danger" | "muted" }) {
  return <span className={`${size === "lg" ? "text-amount-lg" : "text-amount"} ${tone === "danger" ? "text-danger" : tone === "muted" ? "text-muted-foreground" : "text-foreground"} inline-block max-w-full wrap-anywhere`}>{formatMoney(value, currency)}</span>;
}
