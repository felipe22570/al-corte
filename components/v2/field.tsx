import type { ReactNode } from "react";
import { cx } from "./cx";

/** Ids that tie a control to its help and error text. */
export function fieldIds(id: string) {
  return { hint: `${id}-hint`, error: `${id}-error` };
}

/** Value for `aria-describedby`: the help and error shown, if any. */
export function describedBy(id: string, hint?: ReactNode, error?: ReactNode): string | undefined {
  const ids = fieldIds(id);
  return [hint ? ids.hint : null, error ? ids.error : null].filter(Boolean).join(" ") || undefined;
}

/**
 * A form field: label, control, help only when it applies and error in one line (docs/design-v2.md, rule 6). The control
 * receives `id`, `aria-invalid` and `aria-describedby={describedBy(id, hint, error)}`.
 */
export function Field({ id, label, hint, error, children, className }: { id: string; label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  const ids = fieldIds(id);
  return <div className={cx("ui:flex ui:min-w-0 ui:flex-col ui:gap-1.5", className)}>
    <label htmlFor={id} className="ui:text-support ui:text-text-2">{label}</label>
    {children}
    {hint && !error && <span id={ids.hint} className="ui:text-support ui:text-text-3">{hint}</span>}
    {error && <span id={ids.error} className="ui:text-support ui:text-danger">{error}</span>}
  </div>;
}

/** A group of related controls without a single input to label (Segmented, Stepper). */
export function FieldGroup({ label, labelId, children, className }: { label: ReactNode; labelId: string; children: ReactNode; className?: string }) {
  return <div role="group" aria-labelledby={labelId} className={cx("ui:flex ui:min-w-0 ui:flex-col ui:gap-1.5", className)}>
    <span id={labelId} className="ui:text-support ui:text-text-2">{label}</span>
    {children}
  </div>;
}
