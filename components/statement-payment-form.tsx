"use client";

import Decimal from "decimal.js";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { Money } from "@/components/money";
import { SelectControl } from "@/components/select-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewPayment, registerPayment } from "@/lib/actions/payments";
import type { Currency } from "@/lib/domain/money";
import type { PaymentKind, PrepaymentEffect } from "@/lib/domain/payments";
import { rateFromPesos } from "@/lib/domain/fx-difference";
import { formatExchangeRate, formatMoney } from "@/lib/format";
import { formatAmountInput, parseColombianDecimal } from "@/lib/money-input";
import type { PaymentPreview } from "@/lib/payment-types";

type Props = {
  statementId: string;
  currency: Currency;
  today: string;
  /** Card, cutoff and currency, used in accessible names and messages. */
  context: string;
  /** Visible currency name when one statement shows several payment controls ("pesos", "dólares"). */
  currencyName?: string;
};

function parseInput(value: string): Decimal | null {
  if (!value.trim()) return new Decimal(0);
  try { return new Decimal(parseColombianDecimal(value)); } catch { return null; }
}

/**
 * F14: registers a payment of one statement and currency (D37). Before saving it shows what covers the minimum and the
 * proposed distribution of the prepayment, which the owner can change (D38). A secondary control with unique IDs.
 */
export function StatementPaymentForm({ statementId, currency, today, context, currencyName }: Props) {
  const suffix = currencyName ? ` en ${currencyName}` : "";
  const ids = { panel: useId(), date: useId(), amount: useId(), effect: useId(), help: useId(), kind: useId(), distribution: useId(), pesos: useId(), rate: useId() };
  const router = useRouter();
  const mainButton = useRef<HTMLButtonElement>(null);
  const firstOption = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PaymentKind>("minimum");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState("");
  const [effect, setEffect] = useState<PrepaymentEffect>("reduce_term");
  const [preview, setPreview] = useState<{ key: string; value: PaymentPreview } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(false);
  const [distribution, setDistribution] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  // D56: a dollar payment made with pesos keeps the pesos debited and derives the bank's rate from them.
  const [withPesos, setWithPesos] = useState(false);
  const [pesos, setPesos] = useState("");

  useEffect(() => {
    if (open) firstOption.current?.focus();
  }, [open]);

  const key = `${kind}|${date}|${amount}|${effect}`;
  // The server recomputes the plan on every change: pending minimum, proposal and rebuilt installments (D38).
  useEffect(() => {
    if (!open || (kind === "other" && parseInput(amount)?.gt(0) !== true)) return;
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const result = await previewPayment(statementId, currency, { kind, date, amount, effect });
        if (!active) return;
        if (!result.ok) { setPreview(null); setPreviewError(result.error); return; }
        setPreviewError("");
        setPreview({ key: `${kind}|${date}|${amount}|${effect}`, value: result.preview });
        setDistribution(Object.fromEntries(result.preview.candidates.map((candidate) => [candidate.id, ((amount) => amount ? formatAmountInput(amount) : "")(result.preview.prepayments.find((item) => item.transactionId === candidate.id)?.amount)])));
      } catch {
        if (active) { setPreview(null); setPreviewError("No pudimos calcular el pago. Revisa tu conexión."); }
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [open, kind, date, amount, effect, statementId, currency]);

  const shown = preview?.key === key ? preview.value : null;
  const distributes = kind === "other" && !!shown && new Decimal(shown.prepayable).gt(0);
  const parsedRows = Object.entries(distribution).map(([id, value]) => ({ id, value: parseInput(value) }));
  const invalidRow = parsedRows.some((row) => row.value === null);
  const distributed = parsedRows.reduce((sum, row) => sum.plus(row.value ?? 0), new Decimal(0));
  const difference = shown ? new Decimal(shown.allocatable).minus(distributed) : new Decimal(0);
  const edited = !!shown && shown.candidates.some((candidate) => !parseInput(distribution[candidate.id] ?? "")?.equals(shown.prepayments.find((item) => item.transactionId === candidate.id)?.amount ?? 0));
  const pesosValue = withPesos ? parseInput(pesos) : null;
  const pesosValid = !withPesos || pesosValue?.gt(0) === true;
  const derivedRate = shown && pesosValue?.gt(0) ? rateFromPesos(new Decimal(shown.amount), pesosValue) : null;
  const canSave = !!shown && !loading && !busy && pesosValid && (!distributes || (!invalidRow && difference.isZero()));

  async function save() {
    if (!canSave) return;
    setBusy(true); setMessage("");
    try {
      const result = await registerPayment(statementId, currency, {
        kind, date, amount, effect, copDebited: withPesos ? pesos : "",
        distribution: distributes ? Object.entries(distribution).map(([transactionId, value]) => ({ transactionId, amount: value })) : undefined,
      });
      setFailed(!result.ok);
      if (!result.ok) { setMessage(result.error); return; }
      setMessage(result.markedPaid ? `Registraste el pago y quedó marcado como pagado: ${context}.` : `Registraste el pago: ${context}.`);
      setOpen(false);
      setPreview(null);
      mainButton.current?.focus();
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos registrar el pago. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setOpen(false);
    setPreview(null);
    setMessage("");
    mainButton.current?.focus();
  }

  const options: Array<{ value: PaymentKind; label: string; amount: string | null }> = [
    { value: "minimum", label: "Pago mínimo", amount: preview?.value.minimumAmount ?? null },
    { value: "total", label: "Pago total", amount: preview?.value.totalAmount ?? null },
    { value: "other", label: "Otro valor", amount: null },
  ];

  return <div className="grid gap-2">
    {!open ? (
      <Button ref={mainButton} type="button" variant="outline" className="w-fit" onClick={() => { setOpen(true); setMessage(""); }} aria-expanded={false} aria-controls={ids.panel} aria-label={`Registrar pago · ${context}`}>Registrar pago{suffix}</Button>
    ) : (
      <div id={ids.panel} className="grid min-w-0 gap-4 rounded-md border border-border p-3">
        <fieldset className="grid gap-1">
          <legend className="mb-2 text-body">¿Cuánto pagaste?<span className="sr-only"> · {context}</span></legend>
          {options.map((option, index) => <label key={option.value} className="flex min-h-11 min-w-0 items-center gap-3 text-body">
            <input ref={index === 0 ? firstOption : undefined} type="radio" name={ids.kind} value={option.value} checked={kind === option.value} onChange={() => setKind(option.value)} disabled={busy} className="size-5 shrink-0 accent-foreground" />
            <span className="min-w-0 flex-1">{option.label}</span>
            {option.amount && <Money value={option.amount} currency={currency} />}
          </label>)}
        </fieldset>
        {kind === "other" && <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={ids.amount}>Valor pagado<span className="sr-only"> · {context}</span></Label><Input id={ids.amount} inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} disabled={busy} /></div>}
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={ids.date}>Fecha del pago<span className="sr-only"> · {context}</span></Label><DateInput id={ids.date} calendarLabel={`Fecha del pago · ${context}`} value={date} onValueChange={setDate} disabled={busy} /></div>

        {currency === "USD" && <div className="grid min-w-0 gap-2">
          <label className="flex min-h-11 items-center gap-3 text-body"><input type="checkbox" className="size-5 accent-foreground" checked={withPesos} onChange={(event) => setWithPesos(event.target.checked)} disabled={busy} />Pagué con pesos<span className="sr-only"> · {context}</span></label>
          {withPesos && <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor={ids.pesos}>Pesos debitados<span className="sr-only"> · {context}</span></Label>
            <Input id={ids.pesos} inputMode="decimal" autoComplete="off" placeholder="0" value={pesos} onChange={(event) => setPesos(event.target.value)} disabled={busy} aria-describedby={ids.rate} />
            <p id={ids.rate} className="text-small text-muted-foreground">{derivedRate ? `Tasa del banco: ${formatExchangeRate(derivedRate)}. Se guarda en lugar de la TRM.` : "Copia el valor en pesos que te debitaron. La app calcula la tasa que usó el banco."}</p>
          </div>}
        </div>}
        {loading && <p role="status" className="text-small text-muted-foreground">Calculando…</p>}
        {previewError && <p role="alert" className="text-small text-danger">{previewError}</p>}
        {shown && <dl className="grid gap-1 text-small">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Pagas</dt><dd className="ml-auto text-right"><Money value={shown.amount} currency={currency} /></dd></div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Cubre del mínimo</dt><dd className="ml-auto text-right"><Money value={shown.toMinimum} currency={currency} /></dd></div>
          {new Decimal(shown.prepayable).gt(0) && <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Abono a capital</dt><dd className="ml-auto text-right"><Money value={kind === "total" ? shown.allocatable : shown.prepayable} currency={currency} /></dd></div>}
          {new Decimal(shown.leftover).gt(1) && <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Saldo a favor</dt><dd className="ml-auto text-right"><Money value={shown.leftover} currency={currency} /></dd></div>}
        </dl>}
        {shown && !shown.coversMinimum && <p className="text-small text-muted-foreground">No cubre el mínimo: el saldo no quedará marcado como pagado.</p>}

        {distributes && shown && <>
          <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={ids.effect}>Efecto del abono</Label><SelectControl id={ids.effect} value={effect} onValueChange={(value) => setEffect(value as PrepaymentEffect)} disabled={busy} options={[{ value: "reduce_term", label: "Reducir plazo: misma cuota, menos cuotas" }, { value: "reduce_installment", label: "Reducir cuota: mismo plazo, cuota menor" }]} /></div>
          <fieldset className="grid min-w-0 gap-3" aria-describedby={ids.distribution}>
            <legend className="mb-2 text-body">Distribución del abono</legend>
            <p id={ids.distribution} className="text-small text-muted-foreground">{shown.rule === "directed" ? "Elige a qué compras abonas." : shown.rule === "oldest_first" ? "Tu banco abona primero a la compra más antigua. Puedes cambiarlo." : "Propuesta según el orden de Bancolombia. Puedes cambiarla."}</p>
            {shown.candidates.map((candidate) => {
              const applied = shown.prepayments.find((item) => item.transactionId === candidate.id);
              const fieldId = `${ids.distribution}-${candidate.id}`;
              return <div key={candidate.id} className="grid min-w-0 gap-2 border-t border-border pt-3">
                <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3">
                  <Label htmlFor={fieldId} className="min-w-0 wrap-anywhere">{candidate.label}</Label>
                  <span className="text-small text-muted-foreground">Saldo <Money value={candidate.pending} currency={currency} tone="muted" /></span>
                </div>
                <p className="text-small text-muted-foreground">{candidate.detail}</p>
                <Input id={fieldId} inputMode="decimal" autoComplete="off" placeholder="0" value={distribution[candidate.id] ?? ""} onChange={(event) => setDistribution((current) => ({ ...current, [candidate.id]: event.target.value }))} disabled={busy} aria-label={`Abono a ${candidate.label} · ${context}`} />
                {applied && !edited && <p className="text-small text-muted-foreground">
                  {applied.remainingInstallments === null ? "Baja el cargo en su extracto." : applied.remainingInstallments === 0 ? "Queda pagada." : `Quedan ${applied.remainingInstallments} ${applied.remainingInstallments === 1 ? "cuota" : "cuotas"}${applied.nextInstallment ? ` de ${formatMoney(applied.nextInstallment, currency)}` : ""}.`}
                  {applied.assumed && " Supuesto: Bancolombia no publica el orden entre compras del mismo tipo."}
                </p>}
              </div>;
            })}
            {invalidRow ? <p role="alert" className="text-small text-danger">Ingresa los abonos como 1.234,56.</p>
              : !difference.isZero() && <p role="status" className="text-small text-warning">{difference.gt(0) ? `Falta repartir ${formatMoney(difference, currency)}.` : `Repartiste ${formatMoney(difference.negated(), currency)} de más.`}</p>}
          </fieldset>
        </>}
        {kind === "total" && shown && shown.prepayments.length > 0 && <p className="text-small text-muted-foreground">Liquida {shown.prepayments.length === 1 ? "1 compra a cuotas" : `${shown.prepayments.length} compras a cuotas`}: no quedan cuotas futuras de este extracto.</p>}

        <p id={ids.help} className="text-small text-muted-foreground">Registra un abono a la tarjeta. Si cubre el mínimo, marca este saldo como pagado.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={!canSave} onClick={save} aria-describedby={ids.help} aria-label={`Guardar pago · ${context}`}>{busy ? "Guardando…" : "Guardar pago"}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={cancel}>Cancelar</Button>
        </div>
      </div>
    )}
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-small text-danger" : "text-small text-muted-foreground"}>{message}</p>}
  </div>;
}
