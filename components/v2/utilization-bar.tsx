import type { CardColor } from "@/lib/card-colors";
import { cardBackground } from "./card-dot";
import { cx } from "./cx";

/** Share of the bar to fill: a percentage clamped to 0–100; over the limit still fills the bar, never beyond it. */
export function utilizationWidth(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.min(100, Math.max(0, percent));
}

/** Used credit of a card in its identity color, with a text alternative (accessibility). */
export function UtilizationBar({ percent, color, className }: { percent: number; color: CardColor; className?: string }) {
  const rounded = Math.round(percent);
  return <div role="img" aria-label={`${rounded} por ciento usado`} className={cx("ui:h-2 ui:overflow-hidden ui:rounded-bar ui:bg-track", className)}>
    <div className={cx("ui:h-full", cardBackground[color])} style={{ width: `${utilizationWidth(percent)}%` }} />
  </div>;
}
