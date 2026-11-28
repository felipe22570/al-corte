import type { ReactNode } from "react";
import { cx } from "./cx";

export type DataColumn<Row> = {
  key: string; header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Amounts go right-aligned in tabular figures. */
  align?: "left" | "right";
  className?: string;
};

/** Dense table with real headers and its own horizontal scroll (docs/design-v2.md: dense lists, not one card per row). */
export function DataTable<Row>({ columns, rows, rowKey, caption, minWidth = "45rem", className }: {
  columns: Array<DataColumn<Row>>; rows: Row[]; rowKey: (row: Row) => string;
  /** Accessible name of the table; hidden visually. */
  caption: string;
  minWidth?: string; className?: string;
}) {
  return <div className={cx("ui:overflow-x-auto", className)}>
    <table className="ui:w-full ui:border-collapse ui:text-body" style={{ minWidth }}>
      <caption className="ui:sr-only">{caption}</caption>
      <thead>
        <tr className="ui:text-left ui:text-label ui:uppercase ui:text-text-3">
          {columns.map((column, index) => <th key={column.key} scope="col" className={cx("ui:pb-2.5 ui:font-semibold", index === 0 ? "ui:pr-3" : "ui:px-3", column.align === "right" && "ui:text-right")}>{column.header}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => <tr key={rowKey(row)} className="ui:border-t ui:border-line">
          {columns.map((column, index) => <td key={column.key} className={cx("ui:py-3", index === 0 ? "ui:pr-3" : "ui:px-3", column.align === "right" && "ui:text-right ui:tabular-nums", column.className)}>{column.cell(row)}</td>)}
        </tr>)}
      </tbody>
    </table>
  </div>;
}
