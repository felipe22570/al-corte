"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { markStatementPaid, setStatementRealTotal, unmarkStatementPaid } from "@/lib/actions/statements";

export function StatementControls({ id, realTotal, paid, today }: { id: string; realTotal: string | null; paid: boolean; today: string }) {
  const router = useRouter();
  const [value, setValue] = useState(realTotal?.replace(".", ",") ?? "");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setError(""); setSaved(false);
    try { const result = await action(); if (!result.ok) setError(result.error ?? "No pudimos actualizar el extracto."); else { setSaved(true); router.refresh(); } }
    catch { setError("No pudimos actualizar el extracto."); }
    finally { setBusy(false); }
  }
  return <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"><h2 className="text-heading">Total real</h2><div className="flex flex-col gap-2"><Label htmlFor="statement-real">Valor del extracto</Label><Input id="statement-real" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Sin registrar" aria-describedby="statement-real-help" /><p id="statement-real-help" className="text-small text-muted-foreground">Deja el campo vacío para quitar el valor registrado.</p><Button type="button" variant="outline" disabled={busy} onClick={() => run(() => setStatementRealTotal(id, value))}>Guardar total real</Button></div>{paid ? <Button type="button" variant="outline" disabled={busy} onClick={() => run(() => unmarkStatementPaid(id))}>Deshacer pago</Button> : <div className="flex flex-col gap-2"><Label htmlFor="statement-paid-date">Fecha de pago</Label><Input id="statement-paid-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /><Button type="button" disabled={busy} onClick={() => run(() => markStatementPaid(id, date))}>Marcar como pagado</Button></div>}{busy && <p role="status" className="text-small text-muted-foreground">Guardando…</p>}{saved && <p role="status" className="text-small text-muted-foreground">Extracto actualizado.</p>}{error && <p role="alert" className="text-small text-danger">{error}</p>}</section>;
}
