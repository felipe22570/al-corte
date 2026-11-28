"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { buttonClasses } from "./button";
import { cx } from "./cx";
import { fieldControl } from "./input";

/** Next value of a stepper: whole numbers kept within [min, max]; text that is not a number starts from `min`. */
export function stepValue(value: string | number, delta: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(value, 10);
  const current = Number.isFinite(parsed) ? Math.trunc(parsed) : min;
  return Math.min(max, Math.max(min, current + delta));
}

/**
 * Number of installments with − and + (Nuevo gasto, Cambiar cuotas). The field stays editable; `name` submits it with the
 * form. Controlled with `value`/`onValueChange`, or uncontrolled with `defaultValue`.
 */
export function Stepper({ id, name, label, min = 1, max = 36, value, defaultValue = min, onValueChange, describedBy, invalid, className }: {
  id: string; name?: string; label: string; min?: number; max?: number;
  value?: number; defaultValue?: number; onValueChange?: (value: number) => void;
  describedBy?: string; invalid?: boolean; className?: string;
}) {
  const [own, setOwn] = useState(defaultValue);
  const [text, setText] = useState<string | null>(null);
  const current = value ?? own;
  const change = (next: number) => {
    setText(null);
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  };
  const square = buttonClasses("square");
  return <span className={cx("ui:flex ui:items-center ui:gap-2", className)}>
    <button type="button" className={square} aria-label={`Menos ${label.toLowerCase()}`} aria-controls={id} disabled={current <= min} onClick={() => change(stepValue(current, -1, min, max))}><Minus aria-hidden="true" className="ui:size-5" strokeWidth={1.75} /></button>
    <input id={id} name={name} type="text" inputMode="numeric" autoComplete="off" aria-label={label} aria-describedby={describedBy} aria-invalid={invalid || undefined}
      className={cx(fieldControl, "ui:w-16 ui:text-center ui:tabular-nums")} value={text ?? String(current)}
      onChange={(event) => setText(event.target.value.replace(/\D/g, "").slice(0, 3))}
      onBlur={() => { if (text !== null) change(stepValue(text, 0, min, max)); }} />
    <button type="button" className={square} aria-label={`Más ${label.toLowerCase()}`} aria-controls={id} disabled={current >= max} onClick={() => change(stepValue(current, 1, min, max))}><Plus aria-hidden="true" className="ui:size-5" strokeWidth={1.75} /></button>
  </span>;
}
