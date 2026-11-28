import Decimal from "decimal.js";
import type { CSSProperties } from "react";
import type { CardColor } from "@/lib/card-colors";
import type { Currency } from "@/lib/domain/money";
import { formatMoney } from "@/lib/format";
import { cardBackground, cardColorVar } from "./card-dot";
import { cx } from "./cx";

export type StackedBarItem = { key: string; label: string; color: CardColor; value: Decimal | string; estimated?: boolean };
export type StackedSegment = StackedBarItem & { percent: number };

/**
 * R7: the bar shows the relative composition only when the total is positive and no part is negative. Otherwise it returns
 * null and the caller shows a signed text breakdown: refunds are never hidden, negatives never become positive and nothing
 * is divided by zero. Percentages are whole numbers that add up to 100 (largest remainders).
 */
export function stackedBarSegments(items: StackedBarItem[]): StackedSegment[] | null {
  const values = items.map((item) => new Decimal(item.value));
  const total = values.reduce((sum, value) => sum.plus(value), new Decimal(0));
  if (!total.gt(0) || values.some((value) => value.isNegative())) return null;
  const shares = values.map((value, index) => {
    const exact = value.div(total).times(100);
    return { index, percent: exact.floor().toNumber(), remainder: exact.minus(exact.floor()) };
  });
  const missing = 100 - shares.reduce((sum, share) => sum + share.percent, 0);
  for (const share of [...shares].sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index).slice(0, missing)) share.percent += 1;
  return items.map((item, index) => ({ ...item, percent: shares[index]!.percent })).filter((item) => !new Decimal(item.value).isZero());
}

/** Composition by card of a total (Inicio, Mes), with a text alternative and the signed fallback of R7. */
export function StackedBar({ items, currency = "COP", className }: { items: StackedBarItem[]; currency?: Currency; className?: string }) {
  const segments = stackedBarSegments(items);
  if (!segments) {
    return <ul className={cx("ui:flex ui:flex-col ui:gap-1 ui:text-support", className)}>
      {items.map((item) => <li key={item.key} className="ui:flex ui:justify-between ui:gap-3"><span>{item.label}</span><span className="ui:tabular-nums">{formatMoney(item.value, currency)}</span></li>)}
    </ul>;
  }
  return <div role="img" aria-label={segments.map((segment) => `${segment.label} ${segment.percent} por ciento`).join(", ")} className={cx("ui:flex ui:h-3 ui:gap-0.75", className)}>
    {segments.map((segment) => <span key={segment.key} className={cx("ui:min-w-1 ui:rounded-bar", segment.estimated ? "ui:pattern-estimated" : cardBackground[segment.color])}
      style={{ flex: `${segment.percent} 1 0`, ...(segment.estimated ? { "--v2-pattern-color": cardColorVar(segment.color) } : {}) } as CSSProperties} />)}
  </div>;
}
