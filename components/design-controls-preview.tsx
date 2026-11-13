"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { DateInput } from "@/components/date-input";
import { MonthInput } from "@/components/month-input";
import { SelectControl } from "@/components/select-control";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";

const options = [
  { value: "travel", label: "Tarjeta para viajes y compras internacionales · •••• 5678" },
  { value: "long", label: "TarjetaConUnNombreMuyLargoSinEspaciosParaComprobarElAjusteDelTextoEnPantallasPequeñas" },
  { value: "daily", label: "Tarjeta del día a día · •••• 1234" },
  { value: "archived", label: "Tarjeta archivada", disabled: true },
];

export function DesignControlsPreview() {
  const [card, setCard] = useState("travel");
  const [requiredCard, setRequiredCard] = useState("");
  const [date, setDate] = useState("2026-11-12");

  return (
    <>
      <section aria-labelledby="design-selects" className="flex min-w-0 flex-col gap-4">
        <h2 id="design-selects" className="text-heading">Selectores</h2>
        <p className="text-small text-muted-foreground">Prueba nombres largos, teclado y opciones deshabilitadas. La selección solo cambia este ejemplo.</p>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="design-card" className="text-small">Tarjeta con nombre largo</label>
            <SelectControl id="design-card" value={card} onValueChange={setCard} options={options} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="design-card-disabled" className="text-small">Tarjeta deshabilitada</label>
            <SelectControl id="design-card-disabled" value="daily" disabled options={options} />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="design-card-error" className="text-small">Tarjeta requerida</label>
            <SelectControl id="design-card-error" value={requiredCard} onValueChange={setRequiredCard} options={options} aria-invalid={!requiredCard} aria-describedby={!requiredCard ? "design-card-error-message" : undefined} />
            {!requiredCard && <p id="design-card-error-message" className="text-small text-danger">Elige una tarjeta.</p>}
          </div>
        </div>
      </section>
      <section aria-labelledby="design-dates" className="flex min-w-0 flex-col gap-4">
        <h2 id="design-dates" className="text-heading">Fechas y mes</h2>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="design-date" className="text-small">Fecha de ejemplo</label>
            <DateInput id="design-date" value={date} onValueChange={setDate} calendarLabel="Fecha de ejemplo" />
          </div>
          <MonthInput value="2026-11" name="example-month" />
        </div>
      </section>
      <section aria-labelledby="design-disclosures" className="flex min-w-0 flex-col gap-4">
        <h2 id="design-disclosures" className="text-heading">Desplegables</h2>
        <Disclosure>
          <DisclosureSummary>
            <span>Opciones del ejemplo</span>
            <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </DisclosureSummary>
          <DisclosureContent><p className="text-small text-muted-foreground">El contenido no agrega bordes anidados. Puedes abrirlo y cerrarlo con Enter o Espacio.</p></DisclosureContent>
        </Disclosure>
      </section>
    </>
  );
}
