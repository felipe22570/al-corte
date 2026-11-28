import type { ComponentProps } from "react";
import { cx } from "./cx";

/**
 * Shared look of text fields and selects: 40 px (44 px and 16 px text on a phone), `ground` background, `field-border`.
 * Without a width, so each control sets its own (`ui:w-full` or a fixed one) without conflicting classes.
 */
export const fieldControl = "ui:h-10 ui:max-md:h-11 ui:min-w-0 ui:rounded-control ui:border ui:border-field-border ui:bg-ground ui:px-3 ui:text-input ui:text-text ui:placeholder:text-text-3 ui:aria-invalid:border-danger ui:disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(fieldControl, "ui:w-full", className)} {...props} />;
}

/** Amount field: decimal keyboard and tabular figures. An empty field is not a zero: it shows its example (D66). */
export function AmountInput({ className, ...props }: Omit<ComponentProps<"input">, "type" | "inputMode">) {
  return <input type="text" inputMode="decimal" autoComplete="off" className={cx(fieldControl, "ui:w-full ui:tabular-nums", className)} {...props} />;
}
