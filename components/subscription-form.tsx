"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { DateInput } from "@/components/date-input";
import { SelectControl } from "@/components/select-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetFooter } from "@/components/ui/sheet";
import { createSubscription, updateSubscription } from "@/lib/actions/subscriptions";
import { cardColorClasses } from "@/lib/card-colors";
import type { SubscriptionCard, SubscriptionCategory, SubscriptionRecord } from "@/lib/subscription-types";
import { subscriptionSchema, type SubscriptionInput } from "@/lib/validation/subscription";


export function SubscriptionForm({ cards, categories, today, subscription }: { cards: SubscriptionCard[]; categories: SubscriptionCategory[]; today: string; subscription?: SubscriptionRecord }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [warning, setWarning] = useState("");
  const [saved, setSaved] = useState(false);
  const defaults: SubscriptionInput = { name: subscription?.name ?? "", cardId: subscription?.cardId ?? cards[0]?.id ?? "", categoryId: subscription?.categoryId ?? "", amount: subscription?.amount.replace(".", ",") ?? "", currency: subscription?.currency ?? "COP", frequency: subscription?.frequency ?? "monthly", billingDay: subscription?.billingDay ?? "", startDate: subscription?.startDate ?? today, trialEndsAt: subscription?.trialEndsAt ?? "" };
  const form = useForm<SubscriptionInput>({ resolver: zodResolver(subscriptionSchema, undefined, { raw: true }), defaultValues: defaults });
  const currency = useWatch({ control: form.control, name: "currency" });
  const errorFor = (field: FieldPath<SubscriptionInput>) => form.formState.errors[field]?.message ? <p id={`subscription-${field}-error`} role="alert" className="text-small text-danger">{String(form.formState.errors[field]?.message)}</p> : null;
  const errorProps = (field: FieldPath<SubscriptionInput>) => ({ "aria-invalid": !!form.formState.errors[field], "aria-describedby": form.formState.errors[field] ? `subscription-${field}-error` : undefined });
  const submit = form.handleSubmit(async (input) => {
    setServerError("");
    try {
      const result = subscription ? await updateSubscription(subscription.id, input) : await createSubscription(input);
      if (!result.ok) { setServerError(result.error); return; }
      setWarning(result.warning ?? ""); setSaved(true); setOpen(false); router.refresh();
    } catch { setServerError("No pudimos guardar la suscripción. Intenta de nuevo."); }
  });
  const missingCard = subscription && !cards.some((card) => card.id === subscription.cardId);
  const missingCategory = subscription?.categoryId && !categories.some((category) => category.id === subscription.categoryId);
  return <><Sheet title={subscription ? "Editar suscripción" : "Agregar suscripción"} open={open} onOpenChange={(next) => { if (next) { form.reset(defaults); setServerError(""); setSaved(false); setWarning(""); } setOpen(next); }} trigger={<Button type="button" variant={subscription ? "outline" : "default"} disabled={!cards.length}>{subscription ? "Editar" : "Agregar suscripción"}</Button>}>
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
      <SheetBody>
      {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
      {(missingCard || missingCategory) && <Alert variant="warning"><AlertDescription>La tarjeta o categoría original está archivada. Elige una opción activa antes de guardar.</AlertDescription></Alert>}
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-name">Nombre</Label><Input id="subscription-name" autoComplete="off" {...errorProps("name")} {...form.register("name")} />{errorFor("name")}</div>
       <div className="flex flex-col gap-2"><Label htmlFor="subscription-card">Tarjeta</Label><Controller control={form.control} name="cardId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="subscription-card" {...errorProps("cardId")} onValueChange={onChange} options={[...(missingCard ? [{ value: subscription.cardId, label: "Tarjeta archivada", disabled: true }] : []), ...cards.map((card) => ({ value: card.id, label: `${card.name} · •••• ${card.last4}`, startAdornment: <span className={`size-2 rounded-full ${cardColorClasses[card.color]}`} /> }))]} />} />{errorFor("cardId")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-category">Categoría</Label><Controller control={form.control} name="categoryId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="subscription-category" {...errorProps("categoryId")} onValueChange={onChange} options={[{ value: "", label: "Sin categoría" }, ...(missingCategory ? [{ value: subscription.categoryId!, label: "Categoría archivada", disabled: true }] : []), ...categories.map((category) => ({ value: category.id, label: category.name }))]} />} />{errorFor("categoryId")}</div>
       <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-4">
       <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="subscription-amount">Valor</Label><div className="flex items-center rounded-md border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring has-aria-invalid:border-danger"><span aria-hidden="true" className={`shrink-0 text-amount-lg ${currency === "USD" ? "mr-2" : ""}`}>{currency === "USD" ? "US$" : "$"}</span><Input id="subscription-amount" inputMode="decimal" placeholder="0" className="h-14 border-0 px-0 text-left text-amount-lg focus-visible:ring-0 pointer-coarse:h-14" {...errorProps("amount")} {...form.register("amount")} /></div>{errorFor("amount")}</div>
       <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="subscription-currency">Moneda</Label><div className="flex h-14 items-center"><Controller control={form.control} name="currency" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="subscription-currency" {...errorProps("currency")} onValueChange={onChange} options={[{ value: "COP", label: "COP" }, { value: "USD", label: "USD" }]} />} /></div>{errorFor("currency")}</div>
       </div>
       <div className="grid grid-cols-2 items-start gap-4">
       <div className="flex flex-col gap-2"><Label htmlFor="subscription-frequency">Frecuencia</Label><Controller control={form.control} name="frequency" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="subscription-frequency" {...errorProps("frequency")} onValueChange={onChange} options={[{ value: "monthly", label: "Mensual" }, { value: "yearly", label: "Anual" }]} />} />{errorFor("frequency")}</div>
       <div className="flex flex-col gap-2"><Label htmlFor="subscription-day">Día de cobro</Label><Input id="subscription-day" inputMode="numeric" type="number" min={1} max={31} {...errorProps("billingDay")} {...form.register("billingDay")} />{errorFor("billingDay")}</div>
       </div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-start">Fecha de inicio</Label><Controller control={form.control} name="startDate" render={({ field: { onChange, value, ...field } }) => <DateInput {...field} id="subscription-start" calendarLabel="Fecha de inicio" value={value} onValueChange={onChange} {...errorProps("startDate")} />} />{errorFor("startDate")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-trial">Fin de prueba gratis (opcional)</Label><Controller control={form.control} name="trialEndsAt" render={({ field: { onChange, value, ...field } }) => <DateInput {...field} id="subscription-trial" calendarLabel="Fin de prueba gratis" value={value ?? ""} onValueChange={onChange} {...errorProps("trialEndsAt")} />} />{errorFor("trialEndsAt")}</div>
      </SheetBody>
       <SheetFooter className="flex-row flex-wrap"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={() => setOpen(false)}>Cancelar</Button></SheetFooter>
    </form>
  </Sheet>{warning ? <p role="status" className="text-small text-warning">{warning}</p> : saved && <p role="status" className="text-small text-muted-foreground">Suscripción guardada.</p>}</>;
}
