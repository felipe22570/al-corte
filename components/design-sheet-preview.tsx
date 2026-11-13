"use client";

import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { SelectControl } from "@/components/select-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";

export function DesignSheetPreview() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [date, setDate] = useState("2026-11-12");
  const [card, setCard] = useState("daily");

  return (
    <section aria-labelledby="design-sheet" className="flex min-w-0 flex-col items-start gap-4">
      <h2 id="design-sheet" className="text-heading">Formulario lateral</h2>
      <p className="text-small text-muted-foreground">Encabezado y acciones fijos, campos desplazables y calendario dentro del formulario. No guarda datos de negocio.</p>
      <Sheet title="Formulario de ejemplo" open={open} onOpenChange={setOpen} trigger={<Button variant="outline">Abrir formulario de ejemplo</Button>}>
        <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => { event.preventDefault(); setSaved(true); setOpen(false); }}>
          <SheetBody>
            <p className="text-small text-muted-foreground">Los cambios solo se muestran en este catálogo.</p>
            <label className="flex flex-col gap-2 text-small">Nombre<Input defaultValue="Suscripción de ejemplo" /></label>
            <div className="flex min-w-0 flex-col gap-2">
              <label htmlFor="design-sheet-card" className="text-small">Tarjeta</label>
              <SelectControl id="design-sheet-card" value={card} onValueChange={setCard} options={[{ value: "daily", label: "Tarjeta del día a día · •••• 1234" }, { value: "travel", label: "Tarjeta para viajes y compras internacionales · •••• 5678" }]} />
            </div>
            <label className="flex flex-col gap-2 text-small">Valor<Input inputMode="decimal" defaultValue="15000" /></label>
            <div className="flex flex-col gap-2">
              <label htmlFor="design-sheet-date" className="text-small">Fecha de inicio</label>
              <DateInput id="design-sheet-date" value={date} onValueChange={setDate} calendarLabel="Fecha del formulario de ejemplo" />
            </div>
            <label className="flex flex-col gap-2 text-small">Categoría<Input defaultValue="Entretenimiento" /></label>
            <label className="flex flex-col gap-2 text-small">Día de cobro<Input type="number" min={1} max={31} defaultValue="12" /></label>
            <label className="flex flex-col gap-2 text-small">Nota<Input placeholder="Nota opcional" /></label>
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="w-full">Guardar ejemplo</Button>
          </SheetFooter>
        </form>
      </Sheet>
      {saved && <p role="status" className="text-small text-muted-foreground">Ejemplo guardado solo en esta vista.</p>}
    </section>
  );
}
