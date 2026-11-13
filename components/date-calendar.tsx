"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { addDays, addMonths, daysInMonth, isValidIsoDate, parseIsoDate, todayInBogota } from "@/lib/domain/dates";
import { formatDateInput, formatMonth } from "@/lib/format";
import { cn } from "@/lib/utils";

export function DateCalendar({ value, onSelect, label }: { value: string; onSelect: (date: string) => void; label: string }) {
  const [active, setActive] = useState(() => isValidIsoDate(value) ? value : todayInBogota());
  const grid = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);
  const heading = useId();
  useLayoutEffect(() => {
    if (!focusAfterMove.current) return;
    focusAfterMove.current = false;
    // Focus the new day before the popover recovers focus from the removed month.
    grid.current?.querySelector<HTMLButtonElement>(`[data-date="${active}"]`)?.focus();
  }, [active]);
  const { year, month } = parseIsoDate(active);
  const first = `${active.slice(0, 7)}-01`;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const total = daysInMonth(year, month);
  const cells = Array.from({ length: Math.ceil((weekday + total) / 7) * 7 }, (_, index) => {
    const day = index - weekday + 1;
    return day < 1 || day > total ? null : `${active.slice(0, 7)}-${String(day).padStart(2, "0")}`;
  });
  function move(date: string) {
    if (date === active) return;
    focusAfterMove.current = true;
    setActive(date);
  }
  function handleKey(event: KeyboardEvent<HTMLButtonElement>, date: string) {
    const offset = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (offset !== undefined) { event.preventDefault(); move(addDays(date, offset)); }
    else if (event.key === "PageUp" || event.key === "PageDown") { event.preventDefault(); move(addMonths(date, event.key === "PageUp" ? -1 : 1)); }
    else if (event.key === "Home" || event.key === "End") { event.preventDefault(); move(event.key === "Home" ? first : `${active.slice(0, 7)}-${total}`); }
  }
  return <div className="w-fit" aria-label={label}>
    <div className="mb-2 flex items-center justify-between gap-2">
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Mes anterior" disabled={year === 1 && month === 1} onClick={() => setActive(addMonths(active, -1))}><ChevronLeft className="size-5" strokeWidth={1.75} /></Button>
      <p id={heading} aria-live="polite" className="text-small font-medium">{formatMonth(active.slice(0, 7), "long")}</p>
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Mes siguiente" disabled={year === 9999 && month === 12} onClick={() => setActive(addMonths(active, 1))}><ChevronRight className="size-5" strokeWidth={1.75} /></Button>
    </div>
    <div ref={grid} role="grid" aria-labelledby={heading}>
      <div role="row" className="grid grid-cols-7">{["L", "M", "X", "J", "V", "S", "D"].map((day, index) => <span key={index} role="columnheader" aria-label={["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][index]} className="flex h-8 items-center justify-center text-small text-muted-foreground">{day}</span>)}</div>
      {Array.from({ length: cells.length / 7 }, (_, week) => <div key={week} role="row" className="grid grid-cols-7">{cells.slice(week * 7, week * 7 + 7).map((date, index) => <div key={date ?? index} role="gridcell" aria-selected={date ? value === date : undefined}>
        {date && <button type="button" data-date={date} tabIndex={date === active ? 0 : -1} aria-label={formatDateInput(date)} className={cn("flex size-9 items-center justify-center rounded-md text-small outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-11", date === value ? "bg-foreground text-background" : "hover:bg-secondary")} onKeyDown={(event) => handleKey(event, date)} onClick={() => onSelect(date)}>{Number(date.slice(-2))}</button>}
      </div>)}</div>)}
    </div>
    <div className="mt-2 flex justify-between gap-2 border-t border-border pt-2"><Button type="button" variant="ghost" size="sm" onClick={() => onSelect(todayInBogota())}>Hoy</Button><Button type="button" variant="ghost" size="sm" onClick={() => onSelect("")}>Borrar</Button></div>
  </div>;
}
