"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SelectControl } from "@/components/select-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { recordStatementInterest } from "@/lib/actions/statements";

/** F11: the real interest of the bank statement replaces the "Intereses estimados" line. */
export function StatementInterestForm({ id, latestRate }: { id: string; latestRate: string | null }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"COP" | "USD">("COP");
  const [fxRate, setFxRate] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true); setError("");
    try {
      const result = await recordStatementInterest(id, { amount, currency, fxRate });
      if (!result.ok) setError(result.error);
      else { setAmount(""); router.refresh(); }
    } catch { setError("No pudimos registrar los intereses. Intenta de nuevo."); }
    finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="statement-interest-title" className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
      <h2 id="statement-interest-title" className="text-heading">Intereses reales</h2>
      <p className="text-small text-muted-foreground">Copia los intereses de tu extracto. Reemplazan la estimación.</p>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] items-start gap-4">
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="statement-interest-amount">Valor</Label><Input id="statement-interest-amount" inputMode="decimal" autoComplete="off" placeholder="0" value={amount} onChange={(event) => setAmount(event.target.value)} aria-invalid={!!error} aria-describedby={error ? "statement-interest-error" : undefined} /></div>
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor="statement-interest-currency">Moneda</Label><SelectControl id="statement-interest-currency" value={currency} onValueChange={(value) => { setCurrency(value as "COP" | "USD"); setFxRate(value === "USD" ? (latestRate ?? "").replace(".", ",") : ""); }} options={[{ value: "COP", label: "COP" }, { value: "USD", label: "USD" }]} /></div>
      </div>
      {currency === "USD" && <div className="flex flex-col gap-2"><Label htmlFor="statement-interest-rate">TRM</Label><Input id="statement-interest-rate" inputMode="decimal" autoComplete="off" value={fxRate} onChange={(event) => setFxRate(event.target.value)} /></div>}
      {error && <p id="statement-interest-error" role="alert" className="text-small text-danger">{error}</p>}
      <Button type="button" variant="outline" disabled={busy} onClick={submit}>{busy ? "Guardando…" : "Registrar intereses"}</Button>
    </section>
  );
}
