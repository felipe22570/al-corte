"use client";

import { CalendarDays } from "lucide-react";
import { useRef, useState, type ComponentProps } from "react";
import { DateCalendar } from "@/components/date-calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseDateInput } from "@/lib/date-input";
import { formatDateInput } from "@/lib/format";

type Props = Omit<ComponentProps<"input">, "type" | "value" | "defaultValue" | "onChange"> & {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  calendarLabel: string;
};

export function DateInput({ id, value, onValueChange, calendarLabel, disabled, "aria-describedby": describedBy, ...props }: Props) {
  const [open, setOpen] = useState(false);
  const calendar = useRef<HTMLDivElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Input {...props} id={id} disabled={disabled} value={formatDateInput(value)} onChange={(event) => onValueChange(parseDateInput(event.target.value))} inputMode="numeric" placeholder="dd/mm/aaaa" maxLength={10} aria-describedby={[describedBy, `${id}-format`].filter(Boolean).join(" ")} />
        <Popover open={open} onOpenChange={setOpen}><PopoverTrigger render={<Button type="button" variant="outline" size="icon" disabled={disabled} aria-label={`Abrir calendario: ${calendarLabel}`}><CalendarDays aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} /></Button>} /><PopoverContent ref={calendar} className="p-2" aria-label={calendarLabel} initialFocus={() => calendar.current?.querySelector<HTMLButtonElement>('[data-date][tabindex="0"]') ?? true}><DateCalendar key={open ? "open" : "closed"} value={value} label={calendarLabel} onSelect={(date) => { onValueChange(date); setOpen(false); }} /></PopoverContent></Popover>
      </div>
      <p id={`${id}-format`} className="text-small text-muted-foreground">Día/mes/año. Acepta 8 dígitos.</p>
    </div>
  );
}
