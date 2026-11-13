"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { CardColorChip } from "@/components/card-color-chip";
import { DateInput } from "@/components/date-input";
import { Money } from "@/components/money";
import { SelectControl } from "@/components/select-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { storageKey } from "@/lib/brand";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { buildTransactionPlan, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { formatDateShort, formatRate } from "@/lib/format";
import type { TransactionCardOption, TransactionCategoryOption } from "@/lib/transaction-options";
import { decodeTransactionDraft, encodeTransactionDraft, transactionDraftKey } from "@/lib/transaction-draft";
import { transactionSchema, type TransactionInput } from "@/lib/validation/transaction";

export function TransactionForm({ userId, cards, categories, today, latestRate, edit }: { userId: string; cards: TransactionCardOption[]; categories: TransactionCategoryOption[]; today: string; latestRate: string | null; edit?: { id: string; initial: TransactionInput; original: { cardId: string; type: TransactionPlanInput["type"]; rateEaApplied: string | null }; hasPaidInstallments: boolean } }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [draftNotice, setDraftNotice] = useState<"" | "saved" | "restored" | "unavailable">("");
  const [ready, setReady] = useState(false);
  const skipDraft = useRef(false);
  const options = useRef<HTMLDetailsElement>(null);
  const defaults = useMemo<TransactionInput>(() => edit?.initial ?? { cardId: cards[0]?.id ?? "", type: "purchase", date: today, amount: "", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, categoryId: "", merchant: "", note: "" }, [edit, cards, today]);
  const pristine = useRef(JSON.stringify(defaults));
  const baseline = edit ? JSON.stringify({ initial: edit.initial, original: edit.original }) : "new";
  const draftKey = transactionDraftKey(userId, edit?.id);
  const form = useForm<TransactionInput>({
    resolver: zodResolver(transactionSchema, undefined, { raw: true }),
    defaultValues: defaults,
  });
  const { reset, subscribe, formState: { isDirty } } = form;
  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      // Restore only after hydration, without changing the server-rendered defaults.
      await Promise.resolve();
      if (cancelled) return;
      let initial = defaults;
      let recovered = false;
      try {
        const restored = decodeTransactionDraft(sessionStorage.getItem(draftKey), baseline);
        if (restored) {
          recovered = true;
          setDraftNotice("restored");
          initial = { ...restored, cardId: cards.some((card) => card.id === restored.cardId) ? restored.cardId : "", categoryId: categories.some((category) => category.id === restored.categoryId) ? restored.categoryId : "" };
        } else {
          sessionStorage.removeItem(draftKey);
        }
      } catch { setDraftNotice("unavailable"); }
      if (!edit && initial === defaults) {
        try {
          const lastCard = localStorage.getItem(storageKey("last-card-id"));
          if (lastCard && cards.some((card) => card.id === lastCard)) initial = { ...defaults, cardId: lastCard };
        } catch { /* La preferencia es opcional. */ }
      }
      skipDraft.current = true;
      pristine.current = JSON.stringify(recovered ? defaults : initial);
      reset(initial, { keepDefaultValues: recovered });
      skipDraft.current = false;
      setReady(true);
    }
    void initialize();
    return () => { cancelled = true; };
  }, [defaults, reset, draftKey, baseline, cards, categories, edit]);
  const values = useWatch({ control: form.control });
  const selectedCard = cards.find((card) => card.id === values.cardId);
  const selectedCategory = categories.find((category) => category.id === values.categoryId);
  const CategoryIcon = selectedCategory && Object.hasOwn(categoryIcons, selectedCategory.icon) ? categoryIcons[selectedCategory.icon as CategoryIcon] : null;
  const allowsInstallments = values.type === "purchase" || values.type === "cash_advance";
  const count = Number(values.installmentsCount) || 1;
  const parsed = transactionSchema.safeParse(values);
  let preview: ReturnType<typeof buildTransactionPlan> | null = null;
  let previewError = "";
  if (parsed.success && selectedCard) {
    try { preview = buildTransactionPlan(parsed.data, selectedCard, edit?.original); }
    catch { previewError = "No pudimos calcular las cuotas. Revisa el valor y la cantidad."; }
  }

  useEffect(() => {
    if (!ready) return;
    return subscribe({ formState: { values: true }, callback: ({ values: current }) => {
      if (skipDraft.current) return;
      try {
        if (JSON.stringify(current) === pristine.current) {
          sessionStorage.removeItem(draftKey);
          setDraftNotice("");
          return;
        }
        sessionStorage.setItem(draftKey, encodeTransactionDraft(current, baseline));
        setDraftNotice((notice) => notice === "restored" ? "restored" : "saved");
      } catch { setDraftNotice("unavailable"); }
    } });
  }, [ready, subscribe, draftKey, baseline]);

  useEffect(() => {
    if (ready && document.activeElement === document.body) document.getElementById("transaction-amount")?.focus();
  }, [ready]);

  useEffect(() => {
    if (draftNotice !== "unavailable" || !isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftNotice, isDirty]);

  function discardDraft() {
    try {
      sessionStorage.removeItem(draftKey);
      skipDraft.current = true;
      pristine.current = JSON.stringify(defaults);
      form.reset(defaults);
      skipDraft.current = false;
      setDraftNotice("");
      setServerError("");
    } catch { setDraftNotice("unavailable"); }
  }
  function cancel() {
    if (draftNotice === "unavailable" && isDirty && !window.confirm("No pudimos guardar el borrador. ¿Quieres salir y perder los cambios?")) return;
    router.push(edit ? `/movimientos/${edit.id}` : "/movimientos");
  }

  const submit = (event: FormEvent<HTMLFormElement>) => form.handleSubmit(async (input) => {
    setServerError("");
    let result;
    try { result = edit ? await updateTransaction(edit.id, input) : await createTransaction(input); }
    catch { setServerError("No pudimos guardar el movimiento. Intenta de nuevo."); return; }
    if (!result.ok) {
      setServerError(result.error);
      if ("errors" in result && result.errors) for (const [field, messages] of Object.entries(result.errors)) {
        if (messages?.[0]) form.setError(field as FieldPath<TransactionInput>, { message: messages[0] });
      }
      return;
    }
    try { localStorage.setItem(storageKey("last-card-id"), input.cardId); } catch { /* La preferencia es opcional. */ }
    skipDraft.current = true;
    try { sessionStorage.removeItem(draftKey); } catch { /* El guardado del movimiento ya se completó. */ }
    router.push(edit ? `/movimientos/${edit.id}?notice=updated` : "/?saved=1");
    router.refresh();
  }, (errors) => {
    setServerError("Revisa los campos señalados antes de guardar.");
    if (["type", "date", "currency", "fxRate", "interestFree", "note"].some((field) => field in errors) && options.current) options.current.open = true;
  })(event);
  const errorFor = (field: FieldPath<TransactionInput>) => {
    const message = form.formState.errors[field]?.message;
    return message ? <p id={`transaction-${field}-error`} role="alert" className="text-small text-danger">{String(message)}</p> : null;
  };
  const errorProps = (field: FieldPath<TransactionInput>) => ({ "aria-invalid": !!form.formState.errors[field], "aria-describedby": form.formState.errors[field] ? `transaction-${field}-error` : undefined });

  return <form onSubmit={submit} noValidate><fieldset disabled={!ready || form.formState.isSubmitting} className="flex min-w-0 flex-col gap-6">
    {!ready && <p role="status" className="text-small text-muted-foreground">Preparando el formulario…</p>}
    {draftNotice === "restored" && <p role="status" className="text-small text-muted-foreground">Recuperamos tu borrador de esta pestaña. Revisa los datos antes de guardar.</p>}
    {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
    {edit && <p className="text-small text-muted-foreground">Se conserva la tasa original si mantienes la tarjeta y el tipo. Si los cambias, se usa la tasa vigente.</p>}
    {edit?.hasPaidInstallments && <Alert><AlertDescription>Algunas cuotas están en extractos pagados. Al guardar se regeneran todas las cuotas.</AlertDescription></Alert>}
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-amount">Valor</Label><div className="flex items-center gap-2 rounded-md border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring"><span className="text-amount-lg" aria-hidden="true">{values.currency === "USD" ? "US$" : "$"}</span><Input id="transaction-amount" autoFocus inputMode="decimal" placeholder="0" className="h-16 border-0 px-0 text-right text-amount-lg focus-visible:ring-0 pointer-coarse:h-16" {...errorProps("amount")} {...form.register("amount")} /></div>{errorFor("amount")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-card">Tarjeta</Label><Controller control={form.control} name="cardId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-card" {...errorProps("cardId")} onValueChange={onChange} options={[{ value: "", label: "Elige una tarjeta", disabled: true }, ...cards.map((card) => ({ value: card.id, label: `${card.name} · •••• ${card.last4}` }))]} />} />{selectedCard && <CardColorChip color={selectedCard.color} name={`${selectedCard.name} · •••• ${selectedCard.last4}`} />}{errorFor("cardId")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-category">Categoría</Label><div className="flex items-center gap-3">{CategoryIcon && <CategoryIcon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}<Controller control={form.control} name="categoryId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-category" {...errorProps("categoryId")} onValueChange={onChange} options={[{ value: "", label: "Sin categoría" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} />} /></div>{errorFor("categoryId")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-merchant">Comercio</Label><Input id="transaction-merchant" autoComplete="off" {...errorProps("merchant")} {...form.register("merchant")} />{errorFor("merchant")}</div>
    {allowsInstallments && <div className="flex flex-col gap-2"><Label htmlFor="transaction-count">Cuotas</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Reducir cuotas" disabled={count <= 1} onClick={() => form.setValue("installmentsCount", String(Math.max(1, count - 1)), { shouldValidate: true, shouldDirty: true })}><Minus className="size-5" strokeWidth={1.75} /></Button><Input id="transaction-count" type="number" min={1} max={36} inputMode="numeric" className="w-20 text-center" {...errorProps("installmentsCount")} {...form.register("installmentsCount")} /><Button type="button" variant="outline" size="icon" aria-label="Aumentar cuotas" disabled={count >= 36} onClick={() => form.setValue("installmentsCount", String(Math.min(36, count + 1)), { shouldValidate: true, shouldDirty: true })}><Plus className="size-5" strokeWidth={1.75} /></Button></div>{errorFor("installmentsCount")}</div>}
    <Disclosure ref={options}><DisclosureSummary><span>Más opciones</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary><DisclosureContent className="flex flex-col gap-4">
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-type">Tipo</Label><Controller control={form.control} name="type" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-type" {...errorProps("type")} onValueChange={(value) => { onChange(value); if (value !== "purchase" && value !== "cash_advance") form.setValue("installmentsCount", "1"); if (value !== "purchase") form.setValue("interestFree", false); }} options={[{ value: "purchase", label: "Compra" }, { value: "cash_advance", label: "Avance" }, { value: "payment", label: "Pago" }, { value: "handling_fee", label: "Cuota de manejo" }, { value: "interest", label: "Interés" }, { value: "insurance", label: "Seguro" }, { value: "refund", label: "Devolución" }, { value: "adjustment", label: "Ajuste" }]} />} />{errorFor("type")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-date">Fecha</Label><Controller control={form.control} name="date" render={({ field: { onChange, value, ...field } }) => <DateInput {...field} id="transaction-date" calendarLabel="Fecha del movimiento" value={value ?? ""} onValueChange={onChange} {...errorProps("date")} />} />{errorFor("date")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-currency">Moneda</Label><Controller control={form.control} name="currency" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-currency" onValueChange={(value) => { onChange(value); form.setValue("fxRate", value === "USD" ? (latestRate ?? "").replace(".", ",") : ""); }} options={[{ value: "COP", label: "COP" }, { value: "USD", label: "USD" }]} />} /></div>
      {values.currency === "USD" && <div className="flex flex-col gap-2"><Label htmlFor="transaction-rate">TRM</Label><Input id="transaction-rate" inputMode="decimal" {...errorProps("fxRate")} {...form.register("fxRate")} />{errorFor("fxRate")}</div>}
      {values.type === "purchase" && <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-primary" {...form.register("interestFree")} />Compra sin intereses</label>}
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-note">Nota</Label><textarea id="transaction-note" rows={3} className="w-full rounded-md border border-input bg-card p-3 text-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...errorProps("note")} {...form.register("note")} />{errorFor("note")}</div>
    </DisclosureContent></Disclosure>
    {preview && allowsInstallments && <section aria-label="Vista previa de cuotas" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Vista previa</h2><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-body">Primera cuota</span><Money value={preview.firstInstallment} currency={parsed.success ? parsed.data.currency : "COP"} /></div>{values.currency === "USD" && <p className="text-small text-muted-foreground">Estimado en pesos: <Money value={preview.firstInstallmentCop} currency="COP" /></p>}<p className="text-small text-muted-foreground">Corte del {formatDateShort(preview.firstCutoff, today)} · pagas el {formatDateShort(preview.dueDate, today)}</p><p className="text-small text-muted-foreground">{preview.totalInterest === "0" ? "Sin intereses" : <>Intereses totales: <Money value={preview.totalInterest} currency={parsed.success ? parsed.data.currency : "COP"} /></>}</p>{values.type === "cash_advance" && selectedCard && <p className="text-small text-muted-foreground">Tasa de avances: {formatRate(selectedCard.advanceRateEa)} · comisión: <Money value={preview.advanceFee} currency="COP" /></p>}</section>}
    {previewError && <p role="alert" className="text-small text-danger">{previewError}</p>}
    {draftNotice && <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className={`text-small ${draftNotice === "unavailable" ? "text-warning" : "text-muted-foreground"}`}>{draftNotice === "unavailable" ? "No pudimos conservar el borrador. No cierres esta pestaña sin guardar." : "Tu borrador se conserva en esta pestaña por hasta 24 horas, también al cancelar."}</p>{draftNotice !== "unavailable" && <Button type="button" variant="outline" size="sm" onClick={discardDraft}>Descartar borrador</Button>}</div>}
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 flex gap-3 border-t border-border bg-card p-4 md:static md:border-0 md:bg-transparent md:p-0"><Button type="submit" className="flex-1 md:flex-none" disabled={form.formState.isSubmitting || !!previewError}>{form.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button><Button type="button" variant="outline" className="flex-1 md:flex-none" onClick={cancel}>Cancelar</Button></div>
  </fieldset></form>;
}
