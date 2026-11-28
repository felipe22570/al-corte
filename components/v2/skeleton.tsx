import { cx } from "./cx";

/** Placeholder while a section loads; size it with `ui:h-*` and `ui:w-*`. Hidden from screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("ui:block ui:rounded-tag ui:bg-surface-raised ui:motion-safe:animate-pulse", className)} />;
}
