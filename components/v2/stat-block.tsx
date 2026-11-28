import type { ReactNode } from "react";
import { cx } from "./cx";

/** A summary figure: small uppercase label, the value and an optional line below (Tarjeta, Mes). */
export function StatBlock({ label, value, hint, info, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; info?: ReactNode; className?: string }) {
  return <div className={cx("ui:flex ui:min-w-0 ui:flex-col ui:gap-1.5", className)}>
    <span className="ui:inline-flex ui:items-center ui:gap-2 ui:text-label ui:uppercase ui:text-text-3">{label}{info}</span>
    <span className="ui:min-w-0">{value}</span>
    {hint && <span className="ui:text-support ui:text-text-3">{hint}</span>}
  </div>;
}
