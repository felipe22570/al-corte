import type { ReactNode } from "react";
import { cx } from "./cx";

/** A panel (`surface`, 16 px radius, 24 px padding) with an optional h2 title and actions on the right. */
export function Panel({ title, titleId, actions, children, className, label }: {
  title?: ReactNode; titleId?: string; actions?: ReactNode; children: ReactNode; className?: string;
  /** Accessible name when the panel has no visible title. */
  label?: string;
}) {
  return <section aria-labelledby={title && titleId ? titleId : undefined} aria-label={!title ? label : undefined}
    className={cx("ui:flex ui:min-w-0 ui:flex-col ui:gap-4 ui:rounded-panel ui:bg-surface ui:p-6 ui:max-md:p-4", className)}>
    {(title || actions) && <div className="ui:flex ui:flex-wrap ui:items-baseline ui:justify-between ui:gap-2">
      {title && <h2 id={titleId} className="ui:m-0 ui:text-heading">{title}</h2>}
      {actions && <div className="ui:flex ui:flex-wrap ui:items-center ui:gap-3">{actions}</div>}
    </div>}
    {children}
  </section>;
}

/** The main block of a screen (`surface-raised`, 18 px radius, 28 px padding): it answers the screen's question. */
export function HeroPanel({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return <section aria-label={label} className={cx("ui:min-w-0 ui:rounded-hero ui:bg-surface-raised ui:p-7 ui:max-md:p-5", className)}>{children}</section>;
}
