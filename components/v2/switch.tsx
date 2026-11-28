"use client";

import { useState } from "react";
import { cx } from "./cx";

/** On/off control (Ajustes: captura de alertas). Controlled with `checked`, or uncontrolled with `defaultChecked`. */
export function Switch({ label, checked, defaultChecked = false, onCheckedChange, disabled, name, className }: {
  label: string; checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean; name?: string; className?: string;
}) {
  const [own, setOwn] = useState(defaultChecked);
  const on = checked ?? own;
  const toggle = () => {
    if (checked === undefined) setOwn(!on);
    onCheckedChange?.(!on);
  };
  return <>
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={toggle}
      className={cx("ui:flex ui:h-7 ui:w-12 ui:shrink-0 ui:cursor-pointer ui:rounded-full ui:p-0.75 ui:disabled:cursor-not-allowed ui:disabled:opacity-50", on ? "ui:justify-end ui:bg-primary" : "ui:justify-start ui:bg-track", className)}>
      <span aria-hidden="true" className={cx("ui:block ui:size-5.5 ui:rounded-full", on ? "ui:bg-on-primary" : "ui:bg-text-2")} />
    </button>
    {name && <input type="hidden" name={name} value={on ? "on" : "off"} />}
  </>;
}
