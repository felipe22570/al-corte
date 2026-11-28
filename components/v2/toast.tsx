import type { ReactNode } from "react";
import { cx } from "./cx";

/** Confirmation after an action ("Movimiento guardado"), announced politely; `floating` pins it above the bottom navigation. */
export function Toast({ children, floating = false, className }: { children: ReactNode; floating?: boolean; className?: string }) {
  return <span role="status" className={cx("ui:inline-flex ui:rounded-block ui:bg-text ui:px-4 ui:py-3 ui:font-semibold ui:text-ground",
    floating && "ui:fixed ui:bottom-24 ui:left-1/2 ui:z-50 ui:-translate-x-1/2 ui:md:bottom-8", className)}>{children}</span>;
}
