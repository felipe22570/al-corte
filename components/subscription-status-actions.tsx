"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { setSubscriptionStatus } from "@/lib/actions/subscriptions";
import type { SubscriptionRecord } from "@/lib/subscription-types";

export function SubscriptionStatusActions({ id, status, name }: { id: string; status: SubscriptionRecord["status"]; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function change(next: "active" | "paused" | "cancelled") {
    if (next === "cancelled" && !window.confirm(`¿Cancelar ${name}? Dejará de generar cobros en Al Corte. Esto no cancela el servicio con el proveedor.`)) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await setSubscriptionStatus(id, next); if (!result.ok) setError(result.error); else { setMessage("Suscripción actualizada."); router.refresh(); } }
    catch { setError("No pudimos actualizar la suscripción."); }
    finally { setBusy(false); }
  }
  if (status === "cancelled") return null;
  return <div className="flex flex-col items-end gap-2">
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="ghost" size="icon" aria-label={`Más opciones de ${name}`} disabled={busy}><MoreHorizontal aria-hidden="true" className="size-5 text-muted-foreground" strokeWidth={1.75} /></Button>} />
      <DropdownMenuContent>
        <DropdownMenuItem disabled={busy} onClick={() => change(status === "active" ? "paused" : "active")}>{status === "active" ? "Pausar" : "Reanudar"}</DropdownMenuItem>
        <DropdownMenuItem destructive disabled={busy} onClick={() => change("cancelled")}>Cancelar suscripción</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <span role="status" className="sr-only">{busy ? "Guardando…" : message}</span>
    {error && <p role="alert" className="max-w-48 text-small text-danger">{error}</p>}
  </div>;
}
