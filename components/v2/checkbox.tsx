import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

/** Native checkbox in the primary color, with its label as the touch target. */
export function Checkbox({ label, className, ...props }: Omit<ComponentProps<"input">, "type"> & { label: ReactNode }) {
  return <label className={cx("ui:inline-flex ui:min-h-9 ui:cursor-pointer ui:items-center ui:gap-2.5 ui:pointer-coarse:min-h-11", className)}>
    <input type="checkbox" className="ui:size-4.5 ui:shrink-0 ui:accent-primary" {...props} />
    <span>{label}</span>
  </label>;
}
