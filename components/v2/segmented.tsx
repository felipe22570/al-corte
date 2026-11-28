"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cx } from "./cx";

export type SegmentedOption<Value extends string> = { value: Value; label: string };

/** Option a key moves to (radio group pattern): arrows wrap around; Home and End go to the ends; other keys do nothing. */
export function segmentedTarget<Value extends string>(options: Array<SegmentedOption<Value>>, current: Value, key: string): Value | null {
  const index = options.findIndex((option) => option.value === current);
  const last = options.length - 1;
  const next = key === "ArrowRight" || key === "ArrowDown" ? (index >= last ? 0 : index + 1)
    : key === "ArrowLeft" || key === "ArrowUp" ? (index <= 0 ? last : index - 1)
      : key === "Home" ? 0 : key === "End" ? last : null;
  return next === null ? null : options[next]!.value;
}

/**
 * Choice among 2 or 3 options ("Compra · Avance", COP/USD, Mensual/Anual): `ground` background, active option in `track`.
 * A radio group for assistive technology; `name` submits the value with the form.
 */
export function Segmented<Value extends string>({ options, value, defaultValue, onValueChange, name, label, labelledBy, className }: {
  options: Array<SegmentedOption<Value>>; value?: Value; defaultValue?: Value; onValueChange?: (value: Value) => void;
  name?: string; label?: string; labelledBy?: string; className?: string;
}) {
  const [own, setOwn] = useState<Value>(defaultValue ?? options[0]!.value);
  const current = value ?? own;
  const refs = useRef(new Map<Value, HTMLButtonElement>());
  const select = (next: Value) => {
    if (value === undefined) setOwn(next);
    onValueChange?.(next);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const next = segmentedTarget(options, current, event.key);
    if (next === null) return;
    event.preventDefault();
    select(next);
    refs.current.get(next)?.focus();
  };
  return <span role="radiogroup" aria-label={label} aria-labelledby={labelledBy} onKeyDown={onKeyDown}
    className={cx("ui:inline-flex ui:gap-1 ui:self-start ui:rounded-control ui:bg-ground ui:p-1", className)}>
    {options.map((option) => {
      const checked = option.value === current;
      return <button key={option.value} ref={(element) => { if (element) refs.current.set(option.value, element); else refs.current.delete(option.value); }}
        type="button" role="radio" aria-checked={checked} tabIndex={checked ? 0 : -1} onClick={() => select(option.value)}
        className={cx("ui:h-8 ui:max-md:h-10 ui:cursor-pointer ui:rounded-item ui:px-3.5 ui:text-support", checked ? "ui:bg-track ui:font-semibold ui:text-text" : "ui:bg-transparent ui:font-medium ui:text-text-2")}>
        {option.label}
      </button>;
    })}
    {name && <input type="hidden" name={name} value={current} />}
  </span>;
}
