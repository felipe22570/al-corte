"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidIsoDate } from "@/lib/domain/dates";
import { parseDateInput } from "@/lib/date-input";
import { formatDateInput } from "@/lib/format";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  calendarLabel: string;
};

export function DateInput({ id, value, onValueChange, calendarLabel, disabled, "aria-describedby": describedBy, ...props }: Props) {
  const picker = useRef<HTMLInputElement>(null);
  const [fallback, setFallback] = useState(false);
  function openPicker() {
    try {
      if (!picker.current?.showPicker) throw new Error("Picker unavailable");
      picker.current.showPicker();
    } catch {
      setFallback(true);
      picker.current?.focus();
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input {...props} id={id} disabled={disabled} value={formatDateInput(value)} onChange={(event) => onValueChange(parseDateInput(event.target.value))} inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10} aria-describedby={[describedBy, `${id}-format`].filter(Boolean).join(" ")} />
        <Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={`Abrir calendario: ${calendarLabel}`} onClick={openPicker}><CalendarDays aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} /></Button>
      </div>
      <p id={`${id}-format`} className="text-small text-muted-foreground">Día/mes/año. Acepta 8 dígitos.</p>
      <input ref={picker} type="date" lang="es-CO" aria-label={`${calendarLabel} en calendario`} aria-hidden={!fallback} tabIndex={fallback ? 0 : -1} className={fallback ? "h-10 w-full rounded-md border border-input bg-card px-3 text-input pointer-coarse:h-11" : "sr-only"} disabled={disabled} value={isValidIsoDate(value) ? value : ""} onChange={(event) => onValueChange(event.target.value)} />
    </div>
  );
}
