import type Decimal from "decimal.js";
import type { Currency } from "@/lib/domain/money";
import { formatMoney } from "@/lib/format";
import { cx } from "./cx";

type Value = Decimal | string;
export type Money = { value: Value; currency: Currency };
export type AmountSize = "hero" | "lg" | "md" | "sm" | "body";

function isZero(value: Value): boolean {
  return Number(value.toString()) === 0;
}

/**
 * Pesos and dollars are never added (D33): pesos lead and dollars follow as "y US$ 9,00". A statement only in dollars
 * leads with dollars instead of "$0".
 */
export function currencyPair(cop: Value, usd: Value): { main: Money; second: Money | null } {
  if (isZero(cop) && !isZero(usd)) return { main: { value: usd, currency: "USD" }, second: null };
  return { main: { value: cop, currency: "COP" }, second: isZero(usd) ? null : { value: usd, currency: "USD" } };
}

/** Text of an amount with its second currency and COP reference, as screen readers and plain text read it. */
export function amountText(main: Money, second?: Money | null, equivalent?: Value | null): string {
  return [
    formatMoney(main.value, main.currency),
    second && !isZero(second.value) ? `y ${formatMoney(second.value, second.currency)}` : null,
    equivalent !== undefined && equivalent !== null ? `≈ ${formatMoney(equivalent, "COP")}` : null,
  ].filter(Boolean).join(" ");
}

const mainSizes: Record<AmountSize, string> = {
  hero: "ui:text-hero",
  lg: "ui:text-amount-lg",
  md: "ui:text-amount",
  sm: "ui:text-amount-sm",
  body: "ui:text-body ui:font-semibold",
};
const secondSizes: Record<AmountSize, string> = {
  hero: "ui:text-second",
  lg: "ui:text-second",
  md: "ui:text-support ui:font-medium",
  sm: "ui:text-support ui:font-medium",
  body: "ui:text-support",
};

/**
 * An amount in tabular figures (docs/design-v2.md): main value in Space Grotesk, the other currency next to it in
 * `text-2` and, for dollars, an optional COP reference with "≈". A zero second currency is not shown.
 */
export function Amount({ value, currency, second, equivalent, size = "body", stacked = false, className }: Money & {
  second?: Money | null; equivalent?: Value | null; size?: AmountSize; stacked?: boolean; className?: string;
}) {
  const showSecond = second && !isZero(second.value);
  return <span className={cx("ui:inline-flex ui:min-w-0 ui:tabular-nums", stacked ? "ui:flex-col ui:items-end" : "ui:flex-wrap ui:items-baseline ui:gap-x-3 ui:gap-y-1", className)}>
    <span className={cx(size === "body" ? "" : "ui:font-display", mainSizes[size])}>{formatMoney(value, currency)}</span>
    {showSecond && <span className={cx(size === "body" ? "" : "ui:font-display", "ui:text-text-2", secondSizes[size])}>y {formatMoney(second.value, second.currency)}</span>}
    {equivalent !== undefined && equivalent !== null && <span className="ui:text-support ui:text-text-3">≈ {formatMoney(equivalent, "COP")}</span>}
  </span>;
}
