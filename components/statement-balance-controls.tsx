"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { StatementPaymentControl } from "@/components/statement-payment-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setStatementBankValues } from "@/lib/actions/statements";
import type { Currency } from "@/lib/domain/money";

/** Bank values and payment mark of one currency of a statement (D33); secondary controls with unique IDs. */
export function StatementBalanceControls({ id, currency, realMinimum, realTotal, paid, today, context }: {
  id: string; currency: Currency; realMinimum: string | null; realTotal: string | null; paid: boolean; today: string; context: string;
}) {
  const router = useRouter();
  const minimumId = useId();
  const totalId = useId();
  const helpId = useId();
  const [minimum, setMinimum] = useState(realMinimum?.replace(".", ",") ?? "");
  const [total, setTotal] = useState(realTotal?.replace(".", ",") ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const result = await setStatementBankValues(id, currency, { realMinimum: minimum, realTotal: total });
      setFailed(!result.ok);
      setMessage(result.ok ? "Guardamos los valores del banco." : result.error);
      if (result.ok) router.refresh();
    } catch {
      setFailed(true);
      setMessage("No pudimos guardar los valores. Intenta de nuevo.");
    } finally { setBusy(false); }
  }
  return <div className="grid gap-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={minimumId}>Pago mínimo del banco<span className="sr-only"> · {context}</span></Label><Input id={minimumId} inputMode="decimal" autoComplete="off" placeholder="Sin registrar" value={minimum} onChange={(event) => setMinimum(event.target.value)} aria-describedby={helpId} /></div>
      <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={totalId}>Deuda total del banco<span className="sr-only"> · {context}</span></Label><Input id={totalId} inputMode="decimal" autoComplete="off" placeholder="Sin registrar" value={total} onChange={(event) => setTotal(event.target.value)} aria-describedby={helpId} /></div>
    </div>
    <p id={helpId} className="text-small text-muted-foreground">Copia los valores de tu extracto. Son una referencia: no cambian el cálculo. Deja un campo vacío para quitarlo.</p>
    <Button type="button" variant="outline" className="w-fit" disabled={busy} onClick={save} aria-label={`Guardar valores del banco · ${context}`}>{busy ? "Guardando…" : "Guardar valores del banco"}</Button>
    {message && <p role={failed ? "alert" : "status"} className={failed ? "text-small text-danger" : "text-small text-muted-foreground"}>{message}</p>}
    <StatementPaymentControl id={id} paid={paid} today={today} context={context} currency={currency} />
  </div>;
}
