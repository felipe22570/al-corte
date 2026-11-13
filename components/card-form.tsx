"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Decimal from "decimal.js";
import { useState } from "react";
import { Controller, useForm, useWatch, type DefaultValues, type FieldPath } from "react-hook-form";
import { CardColorChip } from "@/components/card-color-chip";
import { CardColorPicker } from "@/components/card-color-picker";
import { SelectControl } from "@/components/select-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { createCard, updateCard } from "@/lib/actions/cards";
import { CARD_COLORS, type CardColor } from "@/lib/card-colors";
import type { CardRecord } from "@/lib/settings-types";
import { cardSchema, type CardInput } from "@/lib/validation/card";

const fields: Array<{ name: FieldPath<CardInput>; label: string; inputMode?: "decimal" | "numeric" }> = [
  { name: "name", label: "Nombre" }, { name: "bank", label: "Banco" },
  { name: "last4", label: "Últimos 4 dígitos", inputMode: "numeric" },
  { name: "creditLimit", label: "Cupo total", inputMode: "decimal" },
  { name: "cutoffDay", label: "Día de corte", inputMode: "numeric" },
  { name: "paymentDay", label: "Día de pago", inputMode: "numeric" },
  { name: "purchaseRateEa", label: "Tasa de compras (% E.A.)", inputMode: "decimal" },
  { name: "advanceRateEa", label: "Tasa de avances (% E.A.)", inputMode: "decimal" },
  { name: "advanceFee", label: "Comisión por avance", inputMode: "decimal" },
  { name: "handlingFee", label: "Cuota de manejo mensual", inputMode: "decimal" },
];
const inputValue = (value: string) => value.replace(".", ",");

export function CardForm({ card, usedColors }: { card?: CardRecord; usedColors: CardColor[] }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);
  const preferredColor = CARD_COLORS.find((color) => !usedColors.includes(color)) ?? CARD_COLORS[0];
  const defaultValues: DefaultValues<CardInput> = {
    name: card?.name ?? "", bank: card?.bank ?? "", network: card?.network as CardInput["network"] ?? "Visa", last4: card?.last4 ?? "",
    creditLimit: inputValue(card?.creditLimit ?? "0"), advanceFee: inputValue(card?.advanceFee ?? "0"), handlingFee: inputValue(card?.handlingFee ?? "0"),
    cutoffDay: card?.cutoffDay ?? "", paymentDay: card?.paymentDay ?? "",
    purchaseRateEa: card ? inputValue(new Decimal(card.purchaseRateEa).times(100).toFixed()) : "0",
    advanceRateEa: card ? inputValue(new Decimal(card.advanceRateEa).times(100).toFixed()) : "0",
    amortizationMethod: card?.amortizationMethod ?? "fixed_principal", color: card?.color ?? preferredColor,
  };
  const form = useForm<CardInput>({
    resolver: zodResolver(cardSchema, undefined, { raw: true }),
    defaultValues,
  });
  const [name, last4, color] = useWatch({ control: form.control, name: ["name", "last4", "color"] });
  const renderField = ({ name: field, label, inputMode }: typeof fields[number]) => <div key={field} className="flex min-w-0 flex-col gap-2"><Label htmlFor={`card-${field}`}>{label}</Label><Input id={`card-${field}`} inputMode={inputMode} aria-invalid={!!form.formState.errors[field]} aria-describedby={form.formState.errors[field] ? `card-${field}-error` : undefined} {...form.register(field)} />{form.formState.errors[field]?.message && <p id={`card-${field}-error`} role="alert" className="text-small text-danger">{String(form.formState.errors[field]?.message)}</p>}</div>;
  const onSubmit = form.handleSubmit(async (input) => {
    setServerError("");
    try {
      const result = card ? await updateCard(card.id, input) : await createCard(input);
      if (!result.ok) { setServerError(result.error); return; }
      setOpen(false); setSaved(true);
      if (!card) form.reset();
    } catch { setServerError("No pudimos guardar la tarjeta. Intenta de nuevo."); }
  });

  return <><Sheet title={card ? "Editar tarjeta" : "Agregar tarjeta"} open={open} onOpenChange={(nextOpen) => { if (nextOpen) { form.reset(defaultValues); setServerError(""); setSaved(false); } setOpen(nextOpen); }} trigger={<Button type="button" variant="outline">{card ? "Editar" : "Agregar tarjeta"}</Button>}>
    <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
      <SheetBody className="gap-6">
      {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
      {card && <Alert variant="warning"><AlertDescription>Los cambios de corte o pago solo afectan movimientos nuevos. Las tasas no recalculan cuotas existentes.</AlertDescription></Alert>}
      <fieldset className="flex flex-col gap-4"><legend className="mb-4 text-heading">Datos básicos</legend><div className="grid gap-4 sm:grid-cols-2">{fields.slice(0, 4).map(renderField)}<div className="flex flex-col gap-2"><Label htmlFor="card-network">Franquicia</Label><Controller control={form.control} name="network" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="card-network" onValueChange={onChange} options={["Visa", "Mastercard", "American Express", "Diners", "Otra"].map((value) => ({ value, label: value }))} />} /></div></div></fieldset>
       <fieldset className="flex min-w-0 flex-col gap-4"><legend className="mb-4 text-heading">Fechas</legend><div className="grid grid-cols-2 gap-4">{fields.slice(4, 6).map(renderField)}</div></fieldset>
      <fieldset className="flex flex-col gap-4"><legend className="mb-4 text-heading">Tasas y costos</legend><div className="grid gap-4 sm:grid-cols-2">{fields.slice(6).map(renderField)}<div className="flex flex-col gap-2"><Label htmlFor="card-method">Método de amortización</Label><Controller control={form.control} name="amortizationMethod" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="card-method" onValueChange={onChange} options={[{ value: "fixed_principal", label: "Capital fijo" }, { value: "french", label: "Cuota fija" }]} />} /></div></div></fieldset>
      <Controller control={form.control} name="color" render={({ field }) => <CardColorPicker value={field.value} onChange={field.onChange} />} />
      <CardColorChip color={color ?? preferredColor} name={`${name || "Tu tarjeta"} · •••• ${last4 || "0000"}`} />
      </SheetBody>
       <SheetFooter className="flex-row flex-wrap"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={() => setOpen(false)}>Cancelar</Button></SheetFooter>
    </form>
  </Sheet>{saved && <span role="status" className="text-small text-muted-foreground">Tarjeta guardada.</span>}</>;
}
