import Decimal from "decimal.js";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { CardColor } from "@/lib/card-colors";
import { cardBackground, cardColorVar } from "./card-dot";
import { cx } from "./cx";

export type MonthColumnSegment = { key: string; color: CardColor; value: Decimal | string; estimated?: boolean };
export type MonthColumn = {
  key: string; href?: string;
  /** Short month name ("Dic") and its state line ("Pagado", "Pagas el 2", "Estimado"). */
  label: string; caption: string;
  /** Formatted total shown above the column. */
  total: string;
  segments: MonthColumnSegment[];
  /** The month to pay now is highlighted; paid months are dimmed. */
  current?: boolean; settled?: boolean;
  /** "paid" uses the positive color; the state is always written, never only colored. */
  captionTone?: "paid" | "default";
};

/**
 * Height in px of each segment, proportional to the largest column. Segments of zero or negative value get no height:
 * the column shows its signed total as text (R7).
 */
export function monthColumnHeights(columns: Array<Pick<MonthColumn, "segments">>, maxPx = 150): number[][] {
  const positive = (segment: MonthColumnSegment) => Decimal.max(0, new Decimal(segment.value));
  const totals = columns.map((column) => column.segments.reduce((sum, segment) => sum.plus(positive(segment)), new Decimal(0)));
  const max = Decimal.max(0, ...totals);
  return columns.map((column) => column.segments.map((segment) => max.isZero() ? 0 : positive(segment).div(max).times(maxPx).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()));
}

/** Months as columns: real, open and estimated (pattern) by card, with a table below on each screen as the text alternative. */
export function MonthColumns({ columns, className }: { columns: MonthColumn[]; className?: string }) {
  const heights = monthColumnHeights(columns);
  return <div className={cx("ui:overflow-x-auto", className)}>
    <div className="ui:grid ui:items-end ui:gap-3.5" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(5.5rem, 1fr))` }}>
      {columns.map((column, index) => {
        const content = <>
          <span className={cx("ui:tabular-nums", column.current ? "ui:text-body ui:font-semibold" : "ui:text-support ui:text-text-2")}>{column.total}</span>
          <span aria-hidden="true" className={cx("ui:flex ui:flex-col-reverse ui:gap-0.75", column.settled && "ui:opacity-45")}>
            {column.segments.map((segment, segmentIndex) => heights[index]![segmentIndex]! > 0 && <span key={segment.key}
              className={cx("ui:block ui:rounded-tag", segment.estimated ? "ui:pattern-estimated" : cardBackground[segment.color])}
              style={{ height: `${heights[index]![segmentIndex]}px`, ...(segment.estimated ? { "--v2-pattern-color": cardColorVar(segment.color) } : {}) } as CSSProperties} />)}
          </span>
          <span className={cx("ui:text-support", column.current && "ui:font-semibold")}>
            {column.label}
            <span className={cx("ui:block", column.captionTone === "paid" ? "ui:text-primary" : column.current ? "ui:text-text" : "ui:text-text-2")}>{column.caption}</span>
          </span>
        </>;
        const classes = cx("ui:flex ui:flex-col ui:gap-2 ui:text-text ui:no-underline", column.current && "ui:-m-2.5 ui:p-2.5 ui:rounded-block ui:bg-surface-raised");
        return column.href
          ? <Link key={column.key} href={column.href} data-v2-button="" className={classes} aria-current={column.current ? "true" : undefined}>{content}</Link>
          : <div key={column.key} className={classes}>{content}</div>;
      })}
    </div>
  </div>;
}
