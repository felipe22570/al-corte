"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm, useWatch, type FieldPath } from "react-hook-form";
import { CardColorChip } from "@/components/card-color-chip";
import { Money } from "@/components/money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { storageKey } from "@/lib/brand";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { buildTransactionPlan, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { formatDateShort, formatRate } from "@/lib/format";
import type { TransactionCardOption, TransactionCategoryOption } from "@/lib/transaction-options";
import { transactionSchema, type TransactionInput } from "@/lib/validation/transaction";

const selectClass = "h-11 w-full rounded-md border border-input bg-card px-3 text-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function TransactionForm({ cards, categories, today, latestRate, edit }: { cards: TransactionCardOption[]; categories: TransactionCategoryOption[]; today: string; latestRate: string | null; edit?: { id: string; initial: TransactionInput; original: { cardId: string; type: TransactionPlanInput["type"]; rateEaApplied: string | null }; hasPaidInstallments: boolean } }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<TransactionInput>({ resolver: zodResolver(transactionSchema, undefined, { raw: true }), defaultValues: edit?.initial ?? { cardId: cards[0]?.id ?? "", type: "purchase", date: today, amount: "", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, categoryId: "", merchant: "", note: "" } });
  const { setValue } = form;
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
    if (edit) return;
    try {
      const lastCard = localStorage.getItem(storageKey("last-card-id"));
      if (lastCard && cards.some((card) => card.id === lastCard)) setValue("cardId", lastCard);
    } catch {
      // La preferencia es opcional si el navegador bloquea el almacenamiento.
    }
  }, [cards, setValue, edit]);

  const submit = form.handleSubmit(async (input) => {
    setServerError("");
    const result = edit ? await updateTransaction(edit.id, input) : await createTransaction(input);
    if (!result.ok) {
      setServerError(result.error);
      if ("errors" in result && result.errors) for (const [field, messages] of Object.entries(result.errors)) {
        if (messages?.[0]) form.setError(field as FieldPath<TransactionInput>, { message: messages[0] });
      }
      return;
    }
    try { localStorage.setItem(storageKey("last-card-id"), input.cardId); } catch { /* La preferencia es opcional. */ }
    router.push(edit ? `/movimientos/${edit.id}` : "/?saved=1");
    router.refresh();
  });
  const errorFor = (field: FieldPath<TransactionInput>) => {
    const message = form.formState.errors[field]?.message;
    return message ? <p role="alert" className="text-small text-danger">{String(message)}</p> : null;
  };

  return <form onSubmit={submit} noValidate className="flex max-w-2xl flex-col gap-6">
    {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
    {edit && <p className="text-small text-muted-foreground">Se conserva la tasa original si mantienes la tarjeta y el tipo. Si los cambias, se usa la tasa vigente.</p>}
    {edit?.hasPaidInstallments && <Alert><AlertDescription>Algunas cuotas están en extractos pagados. Al guardar se regeneran todas las cuotas.</AlertDescription></Alert>}
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-amount">Valor</Label><div className="flex items-center gap-2 rounded-md border border-input bg-card px-3"><span className="text-amount-lg" aria-hidden="true">{values.currency === "USD" ? "US$" : "$"}</span><Input id="transaction-amount" autoFocus inputMode="decimal" placeholder="0" className="h-16 border-0 px-0 text-right text-amount-lg focus-visible:ring-0" aria-invalid={!!form.formState.errors.amount} {...form.register("amount")} /></div>{errorFor("amount")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-card">Tarjeta</Label><select id="transaction-card" className={selectClass} {...form.register("cardId")}><option value="" disabled>Elige una tarjeta</option>{cards.map((card) => <option key={card.id} value={card.id}>{card.name} · •••• {card.last4}</option>)}</select>{selectedCard && <CardColorChip color={selectedCard.color} name={`${selectedCard.name} · •••• ${selectedCard.last4}`} />}{errorFor("cardId")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-category">Categoría</Label><div className="flex items-center gap-3">{CategoryIcon && <CategoryIcon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}<select id="transaction-category" className={selectClass} {...form.register("categoryId")}><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>{errorFor("categoryId")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-merchant">Comercio</Label><Input id="transaction-merchant" autoComplete="off" {...form.register("merchant")} />{errorFor("merchant")}</div>
    {allowsInstallments && <div className="flex flex-col gap-2"><Label htmlFor="transaction-count">Cuotas</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Reducir cuotas" disabled={count <= 1} onClick={() => form.setValue("installmentsCount", String(Math.max(1, count - 1)), { shouldValidate: true })}><Minus className="size-5" strokeWidth={1.75} /></Button><Input id="transaction-count" type="number" min={1} max={36} inputMode="numeric" className="w-20 text-center" {...form.register("installmentsCount")} /><Button type="button" variant="outline" size="icon" aria-label="Aumentar cuotas" disabled={count >= 36} onClick={() => form.setValue("installmentsCount", String(Math.min(36, count + 1)), { shouldValidate: true })}><Plus className="size-5" strokeWidth={1.75} /></Button></div>{errorFor("installmentsCount")}</div>}
    <details className="rounded-xl border border-border bg-card p-4" onToggle={(event) => { if (event.currentTarget.open && window.matchMedia("(max-width: 767px)").matches) event.currentTarget.scrollIntoView({ block: "start" }); }}><summary className="min-h-11 cursor-pointer text-body font-medium">Más opciones</summary><div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-type">Tipo</Label><select id="transaction-type" className={selectClass} {...form.register("type", { onChange: (event) => { if (event.target.value !== "purchase" && event.target.value !== "cash_advance") form.setValue("installmentsCount", "1"); if (event.target.value !== "purchase") form.setValue("interestFree", false); } })}><option value="purchase">Compra</option><option value="cash_advance">Avance</option><option value="payment">Pago</option><option value="handling_fee">Cuota de manejo</option><option value="interest">Interés</option><option value="insurance">Seguro</option><option value="refund">Devolución</option><option value="adjustment">Ajuste</option></select>{errorFor("type")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-date">Fecha</Label><Input id="transaction-date" type="date" {...form.register("date")} />{errorFor("date")}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-currency">Moneda</Label><select id="transaction-currency" className={selectClass} {...form.register("currency", { onChange: (event) => form.setValue("fxRate", event.target.value === "USD" ? (latestRate ?? "").replace(".", ",") : "") })}><option value="COP">COP</option><option value="USD">USD</option></select></div>
      {values.currency === "USD" && <div className="flex flex-col gap-2"><Label htmlFor="transaction-rate">TRM</Label><Input id="transaction-rate" inputMode="decimal" {...form.register("fxRate")} />{errorFor("fxRate")}</div>}
      {values.type === "purchase" && <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-primary" {...form.register("interestFree")} />Compra sin intereses</label>}
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-note">Nota</Label><textarea id="transaction-note" rows={3} className="w-full rounded-md border border-input bg-card p-3 text-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("note")} />{errorFor("note")}</div>
    </div></details>
    {preview && allowsInstallments && <section aria-label="Vista previa de cuotas" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Vista previa</h2><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-body">Primera cuota</span><Money value={preview.firstInstallment} currency={parsed.success ? parsed.data.currency : "COP"} /></div>{values.currency === "USD" && <p className="text-small text-muted-foreground">Estimado en pesos: <Money value={preview.firstInstallmentCop} currency="COP" /></p>}<p className="text-small text-muted-foreground">Corte del {formatDateShort(preview.firstCutoff, today)} · pagas el {formatDateShort(preview.dueDate, today)}</p><p className="text-small text-muted-foreground">{preview.totalInterest === "0" ? "Sin intereses" : <>Intereses totales: <Money value={preview.totalInterest} currency={parsed.success ? parsed.data.currency : "COP"} /></>}</p>{values.type === "cash_advance" && selectedCard && <p className="text-small text-muted-foreground">Tasa de avances: {formatRate(selectedCard.advanceRateEa)} · comisión: <Money value={preview.advanceFee} currency="COP" /></p>}</section>}
    {previewError && <p role="alert" className="text-small text-danger">{previewError}</p>}
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-card p-4 md:static md:border-0 md:bg-transparent md:p-0"><Button type="submit" className="w-full md:w-auto" disabled={form.formState.isSubmitting || !!previewError}>Guardar</Button></div>
  </form>;
}
