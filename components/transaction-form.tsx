"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { DateInput } from "@/components/date-input";
import { Money } from "@/components/money";
import { SelectControl } from "@/components/select-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { confirmDraft } from "@/lib/actions/drafts";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { storageKey } from "@/lib/brand";
import { cardColorClasses } from "@/lib/card-colors";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import { deferralCostSummary } from "@/lib/domain/deferral-cost";
import { normalizeMerchant, recentMerchantNames, suggestFromHistory, type MerchantHistoryRow } from "@/lib/domain/merchant-suggestions";
import { lastClosedCutoff, statementCutoffFor } from "@/lib/domain/statements";
import { buildTransactionPlan, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { formatDateShort, formatPercent, formatRate } from "@/lib/format";
import { applySuggestion, currencyEffects, revertSuggestion, suggestionNotice, type SuggestionField, type SuggestionPatch } from "@/lib/merchant-suggestion-form";
import { formatAmountInput } from "@/lib/money-input";
import type { TransactionCardOption, TransactionCategoryOption } from "@/lib/transaction-options";
import { decodeTransactionFormDraft, encodeTransactionFormDraft, transactionFormDraftKey } from "@/lib/transaction-form-draft";
import { transactionSchema, type TransactionInput } from "@/lib/validation/transaction";

const suggestionFields: SuggestionField[] = ["categoryId", "currency", "fxRate", "installmentsCount", "isInternational", "interestFree"];
const noHistory: MerchantHistoryRow[] = [];

/** A captured draft being confirmed (F18): its prefilled values and the fields merchant history must not change. */
export type CapturedDraft = { id: string; phrase: string; last4: string | null; billingCurrency: "COP" | "USD" | null; unknownCard: boolean; values: TransactionInput; touched: SuggestionField[] };

export function TransactionForm({ userId, cards, categories, today, latestRate, existingCutoffs = {}, merchantHistory = noHistory, edit, captured }: { userId: string; cards: TransactionCardOption[]; categories: TransactionCategoryOption[]; today: string; latestRate: string | null; existingCutoffs?: Record<string, string[]>; merchantHistory?: MerchantHistoryRow[]; edit?: { id: string; initial: TransactionInput; original: { cardId: string; type: TransactionPlanInput["type"]; rateEaApplied: string | null }; hasPaidInstallments: boolean }; captured?: CapturedDraft }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const [draftNotice, setDraftNotice] = useState<"" | "saved" | "restored" | "unavailable">("");
  const [ready, setReady] = useState(false);
  const skipDraft = useRef(false);
  const options = useRef<HTMLDetailsElement>(null);
  // D53: fields the owner changed, recorded from their own handlers, not React Hook Form's dirty state,
  // which also flags values the form sets itself (USD default installments) and restored drafts.
  const touched = useRef(new Set<SuggestionField>(captured?.touched));
  const applied = useRef<{ id: string; cardId: string; name: string; previous: SuggestionPatch } | null>(null);
  const dismissed = useRef(new Set<string>());
  const [suggestionText, setSuggestionText] = useState("");
  const defaults = useMemo<TransactionInput>(() => captured?.values ?? edit?.initial ?? { cardId: cards[0]?.id ?? "", type: "purchase", date: today, amount: "", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, isInternational: false, advanceFee: "", categoryId: "", merchant: "", note: "", inProgress: false, currentInstallment: "", balanceAfter: "", trackedFromCutoff: "" }, [captured, edit, cards, today]);
  const pristine = useRef(JSON.stringify(defaults));
  const baseline = captured ? JSON.stringify({ captured: captured.id, values: captured.values }) : edit ? JSON.stringify({ initial: edit.initial, original: edit.original }) : "new";
  const draftKey = transactionFormDraftKey(userId, captured ? `captured-${captured.id}` : edit?.id);
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
        const restored = decodeTransactionFormDraft(sessionStorage.getItem(draftKey), baseline);
        if (restored) {
          recovered = true;
          // Everything in a restored draft counts as the owner's choice (D53).
          touched.current = new Set(suggestionFields);
          setDraftNotice("restored");
          initial = { ...restored, cardId: cards.some((card) => card.id === restored.cardId) ? restored.cardId : "", categoryId: categories.some((category) => category.id === restored.categoryId) ? restored.categoryId : "" };
        } else {
          sessionStorage.removeItem(draftKey);
        }
      } catch { setDraftNotice("unavailable"); }
      if (captured && !recovered) {
        // Merchant history (D53) completes what the alert and AI left free, as in "Nuevo gasto".
        const found = suggestFromHistory({ merchant: initial.merchant ?? "", cardId: initial.cardId, type: initial.type }, merchantHistory, cards.map((card) => card.id));
        const fromHistory = found ? applySuggestion(initial, found, touched.current, { latestRate, categoryIds: categories.map((category) => category.id) }) : null;
        if (found && fromHistory && Object.keys(fromHistory.patch).length) {
          initial = { ...initial, ...fromHistory.patch };
          applied.current = { id: found.id, cardId: initial.cardId, name: normalizeMerchant(initial.merchant ?? ""), previous: fromHistory.previous };
          setSuggestionText(suggestionNotice(found, today, found.cardId === initial.cardId ? undefined : cards.find((card) => card.id === found.cardId)?.name));
        }
      }
      if (!edit && !captured && initial === defaults) {
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
  }, [defaults, reset, draftKey, baseline, cards, categories, edit, captured, merchantHistory, latestRate, today]);
  const values = useWatch({ control: form.control });
  const suggestionsOn = !edit && merchantHistory.length > 0;
  const merchantNames = useMemo(() => suggestionsOn ? recentMerchantNames(merchantHistory) : [], [suggestionsOn, merchantHistory]);
  const selectedCard = cards.find((card) => card.id === values.cardId);
  const selectedCategory = categories.find((category) => category.id === values.categoryId);
  const CategoryIcon = selectedCategory && Object.hasOwn(categoryIcons, selectedCategory.icon) ? categoryIcons[selectedCategory.icon as CategoryIcon] : null;
  const allowsInstallments = values.type === "purchase" || values.type === "cash_advance";
  const count = Number(values.installmentsCount) || 1;
  // In-progress purchases (F10): installment k sits by default on the last closed statement, or on the open one (D49).
  const canTrackPrior = allowsInstallments && count > 1;
  const closedCutoff = selectedCard ? lastClosedCutoff(selectedCard.cutoffDay, today) : "";
  const trackedOptions = useMemo(() => {
    if (!selectedCard) return [];
    const open = statementCutoffFor(selectedCard.cutoffDay, today);
    const options = [{ value: closedCutoff, label: `Corte del ${formatDateShort(closedCutoff, today)} · último cerrado` }, { value: open, label: `Corte del ${formatDateShort(open, today)} · abierto` }];
    const original = edit?.initial.trackedFromCutoff;
    if (original && edit.initial.cardId === selectedCard.id && original !== closedCutoff && original !== open) options.unshift({ value: original, label: `Corte del ${formatDateShort(original, today)}` });
    return options;
  }, [selectedCard, closedCutoff, today, edit]);
  const fixedPayment = selectedCard?.amortizationMethod === "french";
  // D32: on-balance cards bill principal-only installments; interest comes once per statement.
  const onBalance = selectedCard?.interestMode === "on_balance" && count > 1 && !values.interestFree;
  const parsed = transactionSchema.safeParse(values);
  let preview: ReturnType<typeof buildTransactionPlan> | null = null;
  let previewError = "";
  if (parsed.success && selectedCard) {
    try { preview = buildTransactionPlan(parsed.data, selectedCard, edit?.original); }
    catch (error) { previewError = parsed.data.inProgress && error instanceof Error ? `${error.message}${error.message.endsWith(".") ? "" : "."}` : "No pudimos calcular las cuotas. Revisa el valor y la cantidad."; }
  }
  // F21 (R11, D54): interest of the plan with the card rule; everything about the future is an estimate.
  const cost = preview && allowsInstallments ? deferralCostSummary(preview.deferral, today) : null;
  const tracking = preview && parsed.success && parsed.data.inProgress ? {
    current: parsed.data.inProgress.currentInstallment, count: preview.payload.installments_count, original: preview.payload.original_installments_count,
    alone: !!selectedCard && !(existingCutoffs[selectedCard.id] ?? []).includes(preview.firstCutoff),
  } : null;

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
        sessionStorage.setItem(draftKey, encodeTransactionFormDraft(current, baseline));
        setDraftNotice((notice) => notice === "restored" ? "restored" : "saved");
      } catch { setDraftNotice("unavailable"); }
    } });
  }, [ready, subscribe, draftKey, baseline]);

  useEffect(() => {
    if (!ready || !values.inProgress) return;
    if (!canTrackPrior) form.setValue("inProgress", false, { shouldDirty: true });
    else if (trackedOptions.length && !trackedOptions.some((option) => option.value === values.trackedFromCutoff)) form.setValue("trackedFromCutoff", closedCutoff, { shouldDirty: true });
    // R8 defines the bank balance with the fixed principal P/N; fixed-payment cards only use k.
    if (fixedPayment && values.balanceAfter) form.setValue("balanceAfter", "", { shouldDirty: true });
  }, [ready, form, canTrackPrior, trackedOptions, closedCutoff, fixedPayment, values.inProgress, values.trackedFromCutoff, values.balanceAfter]);

  useEffect(() => {
    if (ready && document.activeElement === document.body) document.getElementById("transaction-amount")?.focus();
  }, [ready]);

  useEffect(() => {
    if (draftNotice !== "unavailable" || !isDirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draftNotice, isDirty]);

  function discardFormDraft() {
    try {
      sessionStorage.removeItem(draftKey);
      skipDraft.current = true;
      pristine.current = JSON.stringify(defaults);
      form.reset(defaults);
      skipDraft.current = false;
      touched.current = new Set(captured?.touched);
      applied.current = null;
      dismissed.current = new Set();
      setSuggestionText("");
      setDraftNotice("");
      setServerError("");
    } catch { setDraftNotice("unavailable"); }
  }

  // F20 (R11, D53): last purchase with this merchant, only in "Nuevo gasto".
  const touch = (field: SuggestionField) => { touched.current.add(field); };
  function setFields(patch: SuggestionPatch) {
    for (const [field, value] of Object.entries(patch)) form.setValue(field as SuggestionField, value as never, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
  }
  function clearSuggestion() {
    if (applied.current) setFields(revertSuggestion(applied.current.previous, touched.current));
    applied.current = null;
    setSuggestionText("");
  }
  function evaluateSuggestion(merchant: string) {
    if (!suggestionsOn) return;
    const { cardId, type } = form.getValues();
    const name = normalizeMerchant(merchant);
    const found = dismissed.current.has(name) ? null : suggestFromHistory({ merchant, cardId, type }, merchantHistory, cards.map((card) => card.id));
    if (found && applied.current?.id === found.id && applied.current.cardId === cardId) return;
    clearSuggestion();
    if (!found) return;
    const { patch, previous } = applySuggestion(form.getValues(), found, touched.current, { latestRate, categoryIds: categories.map((category) => category.id) });
    if (!Object.keys(patch).length) return;
    setFields(patch);
    applied.current = { id: found.id, cardId, name, previous };
    setSuggestionText(suggestionNotice(found, today, found.cardId === cardId ? undefined : cards.find((card) => card.id === found.cardId)?.name));
  }
  function dismissSuggestion() {
    if (applied.current) dismissed.current.add(applied.current.name);
    clearSuggestion();
  }
  function cancel() {
    if (draftNotice === "unavailable" && isDirty && !window.confirm("No pudimos guardar el borrador. ¿Quieres salir y perder los cambios?")) return;
    router.push(captured ? "/por-confirmar" : edit ? `/movimientos/${edit.id}` : "/movimientos");
  }

  const submit = (event: FormEvent<HTMLFormElement>) => form.handleSubmit(async (input) => {
    setServerError("");
    let result;
    try { result = captured ? await confirmDraft(captured.id, input) : edit ? await updateTransaction(edit.id, input) : await createTransaction(input); }
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
    router.push(captured ? "/por-confirmar?notice=confirmed" : edit ? `/movimientos/${edit.id}?notice=updated` : "/?saved=1");
    router.refresh();
  }, (errors) => {
    setServerError("Revisa los campos señalados antes de guardar.");
    if (["type", "interestFree", "note"].some((field) => field in errors) && options.current) options.current.open = true;
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
    {captured && <p className="text-small text-muted-foreground wrap-anywhere">Del correo: «{captured.phrase}»</p>}
    {captured?.unknownCard && <Alert><AlertDescription>{captured.last4 ? `La tarjeta •••• ${captured.last4} no está registrada.` : "No reconocimos la tarjeta."} Elige la tarjeta o agrégala en Ajustes.</AlertDescription></Alert>}
    {captured?.billingCurrency && <Alert><AlertDescription>Sugerido: este cobro puede facturarse en {captured.billingCurrency}. Si es así, cambia la moneda antes de guardar.</AlertDescription></Alert>}
    {edit && <p className="text-small text-muted-foreground">Se conserva la tasa original si mantienes la tarjeta y el tipo. Si los cambias, se usa la tasa vigente.</p>}
    {edit?.hasPaidInstallments && <Alert><AlertDescription>Algunas cuotas están en extractos pagados. Al guardar se regeneran todas las cuotas.</AlertDescription></Alert>}
    <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-4">
      <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="transaction-amount">Valor</Label><div className="flex items-center rounded-md border border-input bg-card px-3 focus-within:ring-2 focus-within:ring-ring has-aria-invalid:border-danger"><span className={`shrink-0 text-amount-lg ${values.currency === "USD" ? "mr-2" : ""}`} aria-hidden="true">{values.currency === "USD" ? "US$" : "$"}</span><Input id="transaction-amount" autoFocus inputMode="decimal" placeholder="0" className="h-14 border-0 px-0 text-left text-amount-lg focus-visible:ring-0 pointer-coarse:h-14" {...errorProps("amount")} {...form.register("amount")} /></div>{errorFor("amount")}</div>
      <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="transaction-currency">Moneda</Label><div className="flex h-14 items-center"><Controller control={form.control} name="currency" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-currency" {...errorProps("currency")} onValueChange={(value) => { touch("currency"); onChange(value); const effects = currencyEffects(value === "USD" ? "USD" : "COP", latestRate); form.setValue("fxRate", effects.fxRate); form.setValue("isInternational", effects.isInternational); if (value === "USD" && allowsInstallments && selectedCard?.usdDefaultInstallments) form.setValue("installmentsCount", String(selectedCard.usdDefaultInstallments), { shouldDirty: true }); }} options={[{ value: "COP", label: "COP" }, { value: "USD", label: "USD" }]} />} /></div>{errorFor("currency")}</div>
    </div>
    {values.currency === "USD" && <div className="flex flex-col gap-2"><Label htmlFor="transaction-rate">TRM</Label><Input id="transaction-rate" inputMode="decimal" {...errorProps("fxRate")} {...form.register("fxRate")} onChange={(event) => { touch("fxRate"); void form.register("fxRate").onChange(event); }} />{errorFor("fxRate")}</div>}
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-card">Tarjeta</Label><Controller control={form.control} name="cardId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-card" {...errorProps("cardId")} onValueChange={(value) => { onChange(value); const card = cards.find((item) => item.id === value); if (values.type === "cash_advance" && card) form.setValue("advanceFee", formatAmountInput(card.advanceFee)); if (applied.current) evaluateSuggestion(form.getValues("merchant") ?? ""); }} options={[{ value: "", label: "Elige una tarjeta", disabled: true }, ...cards.map((card) => ({ value: card.id, label: `${card.name} · •••• ${card.last4}`, startAdornment: <span className={`size-2 rounded-full ${cardColorClasses[card.color]}`} /> }))]} />} />{errorFor("cardId")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-category">Categoría</Label><div className="flex items-center gap-3">{CategoryIcon && <CategoryIcon className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />}<Controller control={form.control} name="categoryId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-category" {...errorProps("categoryId")} onValueChange={(value) => { touch("categoryId"); onChange(value); }} options={[{ value: "", label: "Sin categoría" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} />} /></div>{errorFor("categoryId")}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-merchant">Comercio</Label><Input id="transaction-merchant" autoComplete="off" list={merchantNames.length ? "transaction-merchant-options" : undefined} {...errorProps("merchant")} {...form.register("merchant")} onChange={(event) => { void form.register("merchant").onChange(event); if (merchantNames.includes(event.target.value)) evaluateSuggestion(event.target.value); }} onBlur={(event) => { void form.register("merchant").onBlur(event); evaluateSuggestion(event.target.value); }} />{merchantNames.length > 0 && <datalist id="transaction-merchant-options">{merchantNames.map((name) => <option key={name} value={name} />)}</datalist>}{errorFor("merchant")}{suggestionText && <div className="flex flex-wrap items-center justify-between gap-2"><p role="status" className="text-small text-muted-foreground">{suggestionText}</p><Button type="button" variant="outline" size="sm" onClick={dismissSuggestion}>Quitar sugerencia</Button></div>}</div>
    {allowsInstallments && <div className="flex flex-col gap-2"><Label htmlFor="transaction-count">Cuotas</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" aria-label="Reducir cuotas" disabled={count <= 1} onClick={() => { touch("installmentsCount"); form.setValue("installmentsCount", String(Math.max(1, count - 1)), { shouldValidate: true, shouldDirty: true }); }}><Minus className="size-5" strokeWidth={1.75} /></Button><Input id="transaction-count" type="number" min={1} max={36} inputMode="numeric" className="w-20 text-center" {...errorProps("installmentsCount")} {...form.register("installmentsCount")} onChange={(event) => { touch("installmentsCount"); void form.register("installmentsCount").onChange(event); }} /><Button type="button" variant="outline" size="icon" aria-label="Aumentar cuotas" disabled={count >= 36} onClick={() => { touch("installmentsCount"); form.setValue("installmentsCount", String(Math.min(36, count + 1)), { shouldValidate: true, shouldDirty: true }); }}><Plus className="size-5" strokeWidth={1.75} /></Button></div>{errorFor("installmentsCount")}</div>}
    {values.type === "cash_advance" && !values.inProgress && <div className="flex flex-col gap-2"><Label htmlFor="transaction-advance-fee">Comisión del avance</Label><Input id="transaction-advance-fee" inputMode="decimal" autoComplete="off" placeholder={selectedCard ? formatAmountInput(selectedCard.advanceFee) : "0"} {...errorProps("advanceFee")} aria-describedby={form.formState.errors.advanceFee ? "transaction-advanceFee-error transaction-advance-fee-help" : "transaction-advance-fee-help"} {...form.register("advanceFee")} /><p id="transaction-advance-fee-help" className="text-small text-muted-foreground">La de tu tarjeta por defecto. Cámbiala si el banco cobró otra, por ejemplo en otro cajero.</p>{errorFor("advanceFee")}</div>}
    {canTrackPrior && <div className="flex flex-col gap-4">
      <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-foreground" {...errorProps("inProgress")} {...form.register("inProgress")} />{values.type === "cash_advance" ? "Ya pagué cuotas de este avance" : "Ya pagué cuotas de esta compra"}</label>{errorFor("inProgress")}
      {values.inProgress && <fieldset className="flex min-w-0 flex-col gap-4 rounded-xl border border-border p-4">
        <legend className="sr-only">Cuotas ya pagadas</legend>
        <p className="text-small text-muted-foreground">{fixedPayment ? "Copia la cuota como aparece en tu último extracto." : "Copia la cuota y el saldo como aparecen en tu último extracto."}</p>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex flex-col gap-2"><Label htmlFor="transaction-currentInstallment">Cuota</Label><div className="flex items-center gap-2"><Input id="transaction-currentInstallment" inputMode="numeric" autoComplete="off" className="w-20 text-center" {...errorProps("currentInstallment")} {...form.register("currentInstallment")} /><span className="text-body text-muted-foreground">de {count}</span></div>{errorFor("currentInstallment")}</div>
          {!fixedPayment && <div className="flex min-w-0 flex-1 basis-40 flex-col gap-2"><Label htmlFor="transaction-balanceAfter">Saldo pendiente (opcional)</Label><Input id="transaction-balanceAfter" inputMode="decimal" autoComplete="off" placeholder="0" {...errorProps("balanceAfter")} {...form.register("balanceAfter")} />{errorFor("balanceAfter")}</div>}
        </div>
        <div className="flex flex-col gap-2"><Label htmlFor="transaction-trackedFromCutoff">Extracto de esa cuota</Label><Controller control={form.control} name="trackedFromCutoff" render={({ field: { onChange, ...field } }) => <SelectControl {...field} value={field.value ?? ""} id="transaction-trackedFromCutoff" {...errorProps("trackedFromCutoff")} onValueChange={onChange} options={trackedOptions} />} />{errorFor("trackedFromCutoff")}</div>
      </fieldset>}
    </div>}
    <div className="flex flex-col gap-2"><Label htmlFor="transaction-date">Fecha</Label><Controller control={form.control} name="date" render={({ field: { onChange, value, ...field } }) => <DateInput {...field} id="transaction-date" calendarLabel="Fecha del movimiento" value={value ?? ""} onValueChange={onChange} {...errorProps("date")} />} />{errorFor("date")}</div>
    <Disclosure ref={options}><DisclosureSummary><span>Más opciones</span><ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} /></DisclosureSummary><DisclosureContent className="flex flex-col gap-4">
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-type">Tipo</Label><Controller control={form.control} name="type" render={({ field: { onChange, ...field } }) => <SelectControl {...field} id="transaction-type" {...errorProps("type")} onValueChange={(value) => { clearSuggestion(); onChange(value); if (value !== "purchase" && value !== "cash_advance") form.setValue("installmentsCount", "1"); if (value !== "purchase") form.setValue("interestFree", false); if (value !== "purchase" && value !== "cash_advance") form.setValue("isInternational", false); form.setValue("advanceFee", value === "cash_advance" && selectedCard ? formatAmountInput(selectedCard.advanceFee) : ""); evaluateSuggestion(form.getValues("merchant") ?? ""); }} options={[{ value: "purchase", label: "Compra" }, { value: "cash_advance", label: "Avance" }, { value: "payment", label: "Pago" }, { value: "handling_fee", label: "Cuota de manejo" }, { value: "interest", label: "Interés" }, { value: "insurance", label: "Seguro" }, { value: "refund", label: "Devolución" }, { value: "adjustment", label: "Ajuste" }]} />} />{errorFor("type")}</div>
      {values.type === "purchase" && <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-foreground" {...form.register("interestFree")} onChange={(event) => { touch("interestFree"); void form.register("interestFree").onChange(event); }} />Compra sin intereses</label>}
      {allowsInstallments && <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-foreground" aria-describedby="transaction-international-help" {...form.register("isInternational")} onChange={(event) => { touch("isInternational"); void form.register("isInternational").onChange(event); }} />{values.type === "cash_advance" ? "Avance internacional" : "Compra internacional"}</label>}
      {allowsInstallments && <p id="transaction-international-help" className="-mt-3 text-small text-muted-foreground">Define en qué orden recibe abonos a capital.</p>}
      <div className="flex flex-col gap-2"><Label htmlFor="transaction-note">Nota</Label><textarea id="transaction-note" rows={3} className="w-full rounded-md border border-input bg-card p-3 text-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...errorProps("note")} {...form.register("note")} />{errorFor("note")}</div>
    </DisclosureContent></Disclosure>
    {preview && allowsInstallments && <section aria-label="Vista previa de cuotas" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Vista previa</h2><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-body">{tracking ? `Cuota ${tracking.current} de ${tracking.count}` : "Primera cuota"}</span><Money value={preview.firstInstallment} currency={parsed.success ? parsed.data.currency : "COP"} /></div>{values.currency === "USD" && <p className="text-small text-muted-foreground">Estimado en pesos: <Money value={preview.firstInstallmentCop} currency="COP" /></p>}<p className="text-small text-muted-foreground">Corte del {formatDateShort(preview.firstCutoff, today)} · pagas el {formatDateShort(preview.dueDate, today)}</p>{tracking && <p className="text-small text-muted-foreground">{tracking.count > tracking.current ? tracking.count - tracking.current === 1 ? "Te falta 1 cuota después de esta." : `Te faltan ${tracking.count - tracking.current} cuotas después de esta.` : "Es la última cuota."}</p>}{tracking?.original && <p className="text-small text-muted-foreground">Según tu saldo, el plan queda en {tracking.count} cuotas en lugar de {tracking.original}.</p>}{tracking?.alone && <p className="text-small text-muted-foreground">Aún no tienes movimientos en el extracto del {formatDateShort(preview.firstCutoff, today)}. Solo tendrá esta cuota.</p>}{cost && <p className="text-small text-muted-foreground">{cost.total.isZero() ? "Sin intereses" : <>{tracking ? "Intereses restantes (estimado)" : "Intereses estimados"}: <Money value={cost.total} currency={preview.deferral.currency} />{!tracking && <> · Total <Money value={preview.deferral.amount.plus(cost.total)} currency={preview.deferral.currency} /></>}</>}</p>}{onBalance && <p className="text-small text-muted-foreground">Tu banco cobra los intereses sobre el saldo, en una línea de cada extracto.</p>}{cost?.exceedsThreshold && !tracking && <Alert><AlertDescription>Diferir esta compra cuesta un {formatPercent(cost.percent)} más.</AlertDescription></Alert>}{values.type === "cash_advance" && selectedCard && <p className="text-small text-muted-foreground">Tasa de avances: {formatRate(selectedCard.advanceRateEa)} · {tracking ? "sin comisión nueva" : <>comisión: <Money value={preview.advanceFee} currency="COP" /></>}</p>}</section>}
    {previewError && <p role="alert" className="text-small text-danger">{previewError}</p>}
    {draftNotice && <div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className={`text-small ${draftNotice === "unavailable" ? "text-warning" : "text-muted-foreground"}`}>{draftNotice === "unavailable" ? "No pudimos conservar el borrador. No cierres esta pestaña sin guardar." : "Tu borrador se conserva en esta pestaña por hasta 24 horas, también al cancelar."}</p>{draftNotice !== "unavailable" && <Button type="button" variant="outline" size="sm" onClick={discardFormDraft}>{captured ? "Deshacer cambios" : "Descartar borrador"}</Button>}</div>}
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={form.formState.isSubmitting || !!previewError}>{form.formState.isSubmitting ? "Guardando…" : captured ? "Confirmar movimiento" : "Guardar"}</Button><Button type="button" variant="outline" onClick={cancel}>Cancelar</Button></div>
  </fieldset></form>;
}
