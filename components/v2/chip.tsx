import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Status tags (docs/design-v2.md): green is paid or positive, amber is soon, red is a problem, the dashed border is
 * estimated. A state never depends on color alone: the tag always carries its text.
 */
export type ChipVariant = "paid" | "due" | "warning" | "danger" | "estimated" | "neutral";

const variants: Record<ChipVariant, string> = {
  paid: "ui:px-2 ui:py-0.5 ui:bg-primary-soft ui:text-primary ui:font-semibold",
  due: "ui:px-2 ui:py-0.5 ui:bg-text ui:text-ground ui:font-semibold",
  warning: "ui:px-2 ui:py-0.5 ui:bg-warning-soft ui:text-warning ui:font-semibold",
  danger: "ui:px-2 ui:py-0.5 ui:bg-danger-soft ui:text-danger ui:font-semibold",
  estimated: "ui:px-1.75 ui:py-px ui:border ui:border-dashed ui:border-dash ui:text-text-2",
  neutral: "ui:px-2 ui:py-0.5 ui:bg-track ui:text-text ui:font-semibold",
};

export function Chip({ variant = "neutral", children, className }: { variant?: ChipVariant; children: ReactNode; className?: string }) {
  return <span className={cx("ui:inline-flex ui:items-center ui:whitespace-nowrap ui:rounded-tag ui:text-tag", variants[variant], className)}>{children}</span>;
}
