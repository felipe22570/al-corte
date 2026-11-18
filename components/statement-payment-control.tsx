"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { markStatementPaid, unmarkStatementPaid } from "@/lib/actions/statements";
import type { Currency } from "@/lib/domain/money";

type Props = {
  id: string;
  paid: boolean;
  today: string;
  /** Card and cutoff, used in accessible names and confirmations. */
  context: string;
  /** Formatted cutoff when the statement can still receive charges. */
  openUntil?: string;
  /** Each currency is marked separately (D33). */
  currency?: Currency;
  /** Visible currency name when one statement shows several payment controls ("pesos", "dólares"). */
  currencyName?: string;
};

export function StatementPaymentControl({ id, paid, today, context, openUntil, currency = "COP", currencyName }: Props) {
  const suffix = currencyName ? ` en ${currencyName}` : "";
  const fieldId = useId();
  const panelId = useId();
  const noteId = useId();
  const router = useRouter();
  const mainButton = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (open) document.getElementById(fieldId)?.focus();
  }, [open, fieldId]);

  // When the form collapses or the refreshed statement arrives, return focus to the action that replaced it.
  useEffect(() => {
    if (open || !restoreFocus.current) return;
    restoreFocus.current = false;
    mainButton.current?.focus();
  }, [open, paid]);

  async function update(markPaid: boolean) {
    if (markPaid && date > today) {
      setFailed(true);
      setMessage("La fecha de pago no puede ser posterior a hoy.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = markPaid ? await markStatementPaid(id, date, currency) : await unmarkStatementPaid(id, currency);
      setFailed(!result.ok);
      if (!result.ok) {
        setMessage(result.error ?? "No pudimos actualizar el extracto. Intenta de nuevo.");
        return;
      }
      setMessage(markPaid ? `Marcaste como pagado: ${context}.` : `Quitaste la marca de pago: ${context}.`);
      setOpen(false);
      restoreFocus.current = true;
      router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos actualizar el extracto. Revisa tu conexión e intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    restoreFocus.current = true;
    setOpen(false);
    setMessage("");
  }

  return <div className="grid gap-2">
    {!paid && openUntil && <p className="text-small text-muted-foreground">Aún puede recibir cargos hasta el {openUntil}.</p>}
    {paid ? (
      <Button ref={mainButton} type="button" variant="outline" className="w-fit" disabled={busy} onClick={() => update(false)} aria-label={`Deshacer pago · ${context}`}>Deshacer pago{suffix}</Button>
    ) : !open ? (
      <Button ref={mainButton} type="button" variant="outline" className="w-fit" onClick={() => setOpen(true)} aria-expanded={false} aria-controls={panelId} aria-label={`Marcar como pagado · ${context}`}>Marcar como pagado{suffix}</Button>
    ) : (
      <div id={panelId} className="grid gap-3 rounded-md border border-border p-3">
        <Label htmlFor={fieldId}>¿Cuándo lo pagaste?<span className="sr-only"> {context}</span></Label>
        <DateInput id={fieldId} calendarLabel={`Fecha en que pagaste · ${context}`} value={date} onValueChange={setDate} disabled={busy} aria-describedby={noteId} />
        <p id={noteId} className="text-small text-muted-foreground">Solo marca el extracto. No registra un abono ni libera cupo.</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => update(true)} aria-label={`Confirmar pago · ${context}`}>{busy ? "Guardando…" : "Confirmar"}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={cancel}>Cancelar</Button>
        </div>
      </div>
    )}
    {busy && !open && <p role="status" className="text-small text-muted-foreground">Guardando…</p>}
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-small text-danger" : "text-small text-muted-foreground"}>{message}</p>}
  </div>;
}
