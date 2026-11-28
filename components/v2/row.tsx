import type { ReactNode } from "react";
import { cx } from "./cx";

/** A label and its value on one line, separated from the next by `line` (lists of a panel). Use inside `RowList`. */
export function Row({ label, value, detail, className }: { label: ReactNode; value: ReactNode; detail?: ReactNode; className?: string }) {
  return <div className={cx("ui:flex ui:min-w-0 ui:items-center ui:justify-between ui:gap-3 ui:border-t ui:border-line ui:py-2.5 ui:first:border-t-0", className)}>
    <dt className="ui:min-w-0">{label}{detail && <span className="ui:text-text-3"> · {detail}</span>}</dt>
    <dd className="ui:m-0 ui:shrink-0 ui:text-right ui:tabular-nums">{value}</dd>
  </div>;
}

export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cx("ui:m-0 ui:flex ui:flex-col", className)}>{children}</dl>;
}
