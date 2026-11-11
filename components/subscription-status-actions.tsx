"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { setSubscriptionStatus } from "@/lib/actions/subscriptions";
import type { SubscriptionRecord } from "@/lib/subscription-types";

export function SubscriptionStatusActions({ id, status }: { id: string; status: SubscriptionRecord["status"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function change(next: "active" | "paused" | "cancelled") {
    if (next === "cancelled" && !window.confirm("La suscripción dejará de generar cobros. ¿Quieres cancelarla?")) return;
    setBusy(true); setError(""); setMessage("");
    try { const result = await setSubscriptionStatus(id, next); if (!result.ok) setError(result.error); else { setMessage("Suscripción actualizada."); router.refresh(); } }
    catch { setError("No pudimos actualizar la suscripción."); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap gap-2">{status === "active" && <Button type="button" variant="outline" disabled={busy} onClick={() => change("paused")}>Pausar</Button>}{status === "paused" && <Button type="button" variant="outline" disabled={busy} onClick={() => change("active")}>Reanudar</Button>}{status !== "cancelled" && <Button type="button" variant="outline" disabled={busy} onClick={() => change("cancelled")}>Cancelar suscripción</Button>}{busy && <p role="status" className="text-small text-muted-foreground">Guardando…</p>}{!busy && message && <p role="status" className="text-small text-muted-foreground">{message}</p>}{error && <p role="alert" className="text-small text-danger">{error}</p>}</div>;
}
