"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { DateInput } from "@/components/date-input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { markStatementPaid, unmarkStatementPaid } from "@/lib/actions/statements";

export function StatementPaymentControl({ id, paid, today, context }: { id: string; paid: boolean; today: string; context: string }) {
  const fieldId = useId();
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function update() {
    setBusy(true);
    setMessage("");
    try {
      const result = paid ? await unmarkStatementPaid(id) : await markStatementPaid(id, date);
      setFailed(!result.ok);
      setMessage(result.ok ? "Extracto actualizado." : result.error ?? "No pudimos actualizar el extracto.");
      if (result.ok) router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos actualizar el extracto.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="grid gap-2">
    {!paid && <div className="grid gap-2">
      <Label htmlFor={fieldId}>Fecha de pago · {context}</Label>
      <DateInput id={fieldId} calendarLabel={`Fecha de pago · ${context}`} value={date} onValueChange={setDate} disabled={busy} />
    </div>}
    <Button type="button" variant="outline" disabled={busy} onClick={update} aria-label={`${paid ? "Deshacer pago" : "Marcar como pagado"} · ${context}`}>
      {paid ? "Deshacer pago" : "Marcar como pagado"}
    </Button>
    {busy && <p role="status" className="text-small text-muted-foreground">Guardando…</p>}
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-small text-danger" : "text-small text-muted-foreground"}>{message}</p>}
  </div>;
}
