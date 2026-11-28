import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cx } from "./cx";
import { fieldControl } from "./input";

/** Native select with the field look: keyboard and screen readers work as the platform does. */
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return <span className="ui:relative ui:block ui:min-w-0">
    <select className={cx(fieldControl, "ui:w-full ui:appearance-none ui:pr-9", className)} {...props}>{children}</select>
    <ChevronDown aria-hidden="true" className="ui:pointer-events-none ui:absolute ui:right-3 ui:top-1/2 ui:size-4 ui:-translate-y-1/2 ui:text-text-3" strokeWidth={1.75} />
  </span>;
}
