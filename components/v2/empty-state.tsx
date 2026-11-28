import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Empty or failed section (docs/design-v2.md, rule 7): a main empty state has a title and one action; a secondary one, a
 * single line and a link.
 */
export function EmptyState({ title, text, action, className }: { title?: ReactNode; text?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cx("ui:flex ui:min-h-37.5 ui:flex-col ui:items-center ui:justify-center ui:gap-3 ui:rounded-panel ui:bg-surface ui:p-6 ui:text-center", className)}>
    {title && <span className="ui:font-display ui:text-amount-sm">{title}</span>}
    {text && <span className="ui:text-text-2">{text}</span>}
    {action}
  </div>;
}
