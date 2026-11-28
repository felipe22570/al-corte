import type { CardColor } from "@/lib/card-colors";
import { cx } from "./cx";

/** Identity color of each card (`cards.color`), never a state. Classes are literal so Tailwind generates them. */
export const cardBackground: Record<CardColor, string> = {
  "card-1": "ui:bg-card-1", "card-2": "ui:bg-card-2", "card-3": "ui:bg-card-3",
  "card-4": "ui:bg-card-4", "card-5": "ui:bg-card-5", "card-6": "ui:bg-card-6",
};

/** CSS value of a card color, for patterns and inline series that need the raw variable. */
export function cardColorVar(color: CardColor): string {
  return `var(--v2-${color})`;
}

/** Card chip shown next to its name or last 4 digits, always with text beside it. */
export function CardDot({ color, size = "md", className }: { color: CardColor; size?: "sm" | "md"; className?: string }) {
  return <span aria-hidden="true" className={cx("ui:inline-block ui:shrink-0 ui:rounded-bar", size === "sm" ? "ui:size-2.5" : "ui:size-3", cardBackground[color], className)} />;
}
