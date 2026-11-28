import type { ReactNode } from "react";
import { cx } from "./cx";

export type AlertTone = "danger" | "warning" | "neutral";

const tones: Record<AlertTone, { box: string; title: string; action: string }> = {
  danger: { box: "ui:bg-danger-soft", title: "ui:text-danger", action: "ui:[&_a]:text-danger" },
  warning: { box: "ui:bg-warning-soft", title: "ui:text-warning", action: "ui:[&_a]:text-warning" },
  neutral: { box: "ui:bg-surface-raised", title: "ui:text-text", action: "" },
};

/** One-line warning (problem, attention or neutral): a strong title, its detail and at most one action. */
export function Alert({ tone = "neutral", title, children, action }: { tone?: AlertTone; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return <div role="note" className={cx("ui:flex ui:flex-wrap ui:items-center ui:justify-between ui:gap-3 ui:rounded-block ui:px-4 ui:py-3.5", tones[tone].box)}>
    <span className="ui:min-w-0">
      <span className={cx("ui:font-semibold", tones[tone].title)}>{title}</span>
      {children && <span className={tone === "neutral" ? "ui:text-text-3" : undefined}> · {children}</span>}
    </span>
    {action && <span className={cx("ui:text-support", tones[tone].action)}>{action}</span>}
  </div>;
}
