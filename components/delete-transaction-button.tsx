"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteTransaction } from "@/lib/actions/transactions";

export function DeleteTransactionButton({ id, installments, childrenCount }: { id: string; installments: number; childrenCount: number }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function remove() {
    const details = [installments ? `${installments} ${installments === 1 ? "cuota" : "cuotas"}` : "", childrenCount ? `${childrenCount} ${childrenCount === 1 ? "movimiento asociado" : "movimientos asociados"}` : ""].filter(Boolean);
    if (!window.confirm(`Se borra el movimiento${details.length ? ` y ${details.join(" y ")}` : ""}. ¿Quieres continuar?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteTransaction(id);
      if (!result.ok) { setError(result.error); return; }
      router.push("/movimientos");
      router.refresh();
    } catch {
      setError("No pudimos borrar el movimiento. Intenta de nuevo.");
    } finally { setBusy(false); }
  }
  return <div className="flex flex-col gap-2"><Button type="button" variant="destructive" disabled={busy} onClick={remove}>Borrar movimiento</Button>{error && <p role="alert" className="text-small text-danger">{error}</p>}</div>;
}
