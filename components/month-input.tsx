"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { SelectControl } from "@/components/select-control";
import { formatMonth } from "@/lib/format";

export function MonthInput({ value, name }: { value: string; name: string }) {
  const [year, setYear] = useState(value.slice(0, 4));
  const [month, setMonth] = useState(value.slice(5));
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-small">Mes</legend>
      <input type="hidden" name={name} value={`${year.padStart(4, "0")}-${month}`} />
      <div className="grid grid-cols-2 gap-3">
        <SelectControl aria-label="Mes del año" value={month} onValueChange={setMonth} options={Array.from({ length: 12 }, (_, index) => { const number = String(index + 1).padStart(2, "0"); return { value: number, label: formatMonth(`2026-${number}`, "long").split(" ")[0] ?? number }; })} />
        <label className="flex flex-col gap-2 text-small"><span className="sr-only">Año</span><Input type="number" inputMode="numeric" min={2} max={9998} required value={year} onChange={(event) => setYear(event.target.value)} /></label>
      </div>
    </fieldset>
  );
}
