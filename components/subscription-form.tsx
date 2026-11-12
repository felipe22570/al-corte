"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm, type FieldPath } from "react-hook-form";
import { DateInput } from "@/components/date-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet } from "@/components/ui/sheet";
import { createSubscription, updateSubscription } from "@/lib/actions/subscriptions";
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
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
      {(missingCard || missingCategory) && <Alert variant="warning"><AlertDescription>La tarjeta o categoría original está archivada. Elige una opción activa antes de guardar.</AlertDescription></Alert>}
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-name">Nombre</Label><Input id="subscription-name" autoComplete="off" {...errorProps("name")} {...form.register("name")} />{errorFor("name")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-card">Tarjeta</Label><NativeSelect id="subscription-card" {...errorProps("cardId")} {...form.register("cardId")}>{missingCard && <option value={subscription.cardId} disabled>Tarjeta archivada</option>}{cards.map((card) => <option key={card.id} value={card.id}>{card.name} · •••• {card.last4}</option>)}</NativeSelect>{errorFor("cardId")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-category">Categoría</Label><NativeSelect id="subscription-category" {...errorProps("categoryId")} {...form.register("categoryId")}><option value="">Sin categoría</option>{missingCategory && <option value={subscription.categoryId!} disabled>Categoría archivada</option>}{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</NativeSelect>{errorFor("categoryId")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-amount">Valor</Label><Input id="subscription-amount" inputMode="decimal" {...errorProps("amount")} {...form.register("amount")} />{errorFor("amount")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-currency">Moneda</Label><NativeSelect id="subscription-currency" {...errorProps("currency")} {...form.register("currency")}><option value="COP">COP</option><option value="USD">USD</option></NativeSelect>{errorFor("currency")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-frequency">Frecuencia</Label><NativeSelect id="subscription-frequency" {...errorProps("frequency")} {...form.register("frequency")}><option value="monthly">Mensual</option><option value="yearly">Anual</option></NativeSelect>{errorFor("frequency")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-day">Día de cobro</Label><Input id="subscription-day" inputMode="numeric" type="number" min={1} max={31} {...errorProps("billingDay")} {...form.register("billingDay")} />{errorFor("billingDay")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-start">Fecha de inicio</Label><Controller control={form.control} name="startDate" render={({ field: { onChange, value, ...field } }) => <DateInput {...field} id="subscription-start" calendarLabel="Fecha de inicio" value={value} onValueChange={onChange} {...errorProps("startDate")} />} />{errorFor("startDate")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="subscription-trial">Fin de prueba gratis (opcional)</Label><Controller control={form.control} name="trialEndsAt" render={({ field: { onChange, value, ...field } }) => <DateInput {...field} id="subscription-trial" calendarLabel="Fin de prueba gratis" value={value ?? ""} onValueChange={onChange} {...errorProps("trialEndsAt")} />} />{errorFor("trialEndsAt")}</div>
      <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
    </form>
  </Sheet>{warning ? <p role="status" className="text-small text-warning">{warning}</p> : saved && <p role="status" className="text-small text-muted-foreground">Suscripción guardada.</p>}</>;
}
