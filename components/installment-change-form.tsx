"use client";

import Decimal from "decimal.js";
import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Money } from "@/components/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changeInstallmentsAction, previewInstallmentChange, undoInstallmentChange } from "@/lib/actions/installment-changes";
import type { Currency } from "@/lib/domain/money";
import { formatMoney } from "@/lib/format";
import type { InstallmentChangePreview } from "@/lib/installment-change-types";

/**
 * F16: changes the number of installments left of a purchase, as the bank allows (D40). It shows the new installment and
 * the estimated interest difference before saving. A secondary control.
 */
export function InstallmentChangeForm({ transactionId, currency, remaining }: { transactionId: string; currency: Currency; remaining: number }) {
  const router = useRouter();
  const ids = { panel: useId(), count: useId(), help: useId() };
  const mainButton = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(String(remaining));
  const [preview, setPreview] = useState<{ count: string; value: InstallmentChangePreview } | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) document.getElementById(ids.count)?.focus();
  }, [open, ids.count]);

  useEffect(() => {
    if (!open || !/^\d{1,2}$/.test(count.trim())) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await previewInstallmentChange(transactionId, { remaining: count.trim() });
        if (!active) return;
        if (!result.ok) { setPreview(null); setPreviewError(result.error); return; }
        setPreviewError("");
        setPreview({ count, value: result.preview });
      } catch {
        if (active) { setPreview(null); setPreviewError("No pudimos calcular las cuotas. Revisa tu conexión."); }
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [open, count, transactionId]);

  const shown = preview?.count === count ? preview.value : null;
  const difference = shown ? new Decimal(shown.interestDifference) : null;

  async function save() {
    setBusy(true); setMessage("");
    try {
      const result = await changeInstallmentsAction(transactionId, { remaining: count.trim() });
      setFailed(!result.ok);
      if (!result.ok) { setMessage(result.error); return; }
      setMessage(`Cambiaste la compra a ${count.trim()} ${count.trim() === "1" ? "cuota restante" : "cuotas restantes"}.`);
      setOpen(false);
      mainButton.current?.focus();
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos cambiar las cuotas. Revisa tu conexión e intenta de nuevo.");
    } finally { setBusy(false); }
  }

  return <div className="grid gap-2">
    {!open ? <Button ref={mainButton} type="button" variant="outline" className="w-fit" aria-expanded={false} aria-controls={ids.panel} onClick={() => { setOpen(true); setMessage(""); }}>Cambiar cuotas</Button>
      : <div id={ids.panel} className="grid min-w-0 gap-4 rounded-md border border-border p-3">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor={ids.count}>Cuotas restantes</Label>
          <Input id={ids.count} inputMode="numeric" autoComplete="off" value={count} onChange={(event) => setCount(event.target.value)} disabled={busy} aria-describedby={ids.help} />
          <p id={ids.help} className="text-small text-muted-foreground">Entre 1 y 36, desde la próxima cuota sin facturar. Las cuotas ya facturadas no cambian.</p>
        </div>
        {previewError && <p role="alert" className="text-small text-danger">{previewError}</p>}
        {shown && <dl className="grid gap-1 text-small">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Saldo por facturar</dt><dd className="ml-auto text-right"><Money value={shown.pending} currency={currency} /></dd></div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Próxima cuota</dt><dd className="ml-auto text-right"><Money value={shown.nextInstallment} currency={currency} /><span className="block text-muted-foreground">Antes {formatMoney(shown.previousInstallment, currency)}</span></dd></div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Plan completo</dt><dd className="ml-auto text-right">{shown.effectivePlan} cuotas</dd></div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3"><dt className="text-muted-foreground">Intereses estimados</dt><dd className="ml-auto text-right"><Money value={shown.interestAfter} currency={currency} /><span className="block text-muted-foreground">{difference!.isZero() ? "Sin cambio" : `${difference!.gt(0) ? "+" : "−"}${formatMoney(difference!.abs(), currency)} frente a hoy`}</span></dd></div>
        </dl>}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy || !shown} onClick={save}>{busy ? "Guardando…" : "Guardar cambio"}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => { setOpen(false); setPreview(null); mainButton.current?.focus(); }}>Cancelar</Button>
        </div>
      </div>}
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-small text-danger" : "text-small text-muted-foreground"}>{message}</p>}
  </div>;
}

/** Undoes the latest installment change: the installments it replaced come back (last in, first out). */
export function UndoInstallmentChangeButton({ changeId }: { changeId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function undo() {
    setBusy(true); setMessage("");
    try {
      const result = await undoInstallmentChange(changeId);
      if (!result.ok) { setMessage(result.error); return; }
      router.refresh();
    } catch {
      setMessage("No pudimos deshacer el cambio. Intenta de nuevo.");
    } finally { setBusy(false); }
  }
  return <span className="grid gap-1">
    <Button type="button" variant="ghost" size="sm" className="w-fit" disabled={busy} onClick={undo}>{busy ? "Deshaciendo…" : "Deshacer cambio"}</Button>
    {message && <span role="alert" className="text-small text-danger">{message}</span>}
  </span>;
}
