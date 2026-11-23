"use client";

import { useState, useTransition, type FormEvent } from "react";
import { SelectControl } from "@/components/select-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCardAlias, removeCardAlias, setCaptureEnabled } from "@/lib/actions/capture";
import { cardColorClasses, type CardColor } from "@/lib/card-colors";

type CaptureCard = { id: string; name: string; last4: string; color: CardColor };
type CaptureAlias = { id: string; cardId: string; last4: string };

/**
 * Email capture in Ajustes (F18, D51): the on/off switch and other last 4 digits per card (D44). The signing secret is
 * not managed here; rotating it is a documented procedure.
 */
export function CaptureSettings({ enabled, cards, aliases }: { enabled: boolean; cards: CaptureCard[]; aliases: CaptureAlias[] }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [cardId, setCardId] = useState(cards[0]?.id ?? "");
  const [last4, setLast4] = useState("");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    startTransition(async () => {
      setError("");
      try {
        const result = await action();
        if (!result.ok) setError(result.error ?? "No pudimos guardar el cambio. Intenta de nuevo.");
        else onDone?.();
      } catch { setError("No pudimos guardar el cambio. Intenta de nuevo."); }
    });
  }
  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    run(() => addCardAlias({ cardId, last4 }), () => setLast4(""));
  }
  const cardOf = (id: string) => cards.find((card) => card.id === id);

  return <div className="flex min-w-0 flex-col gap-4">
    <label className="flex min-h-11 items-center gap-3 text-body">
      <input type="checkbox" className="size-5 accent-foreground" checked={enabled} disabled={pending} onChange={(event) => run(() => setCaptureEnabled(event.target.checked))} aria-describedby="capture-help" />
      Recibir las alertas de compra en Por confirmar
    </label>
    <p id="capture-help" className="-mt-2 text-small text-muted-foreground">{enabled
      ? "Las alertas de tu tarjeta de crédito llegan como movimientos por confirmar. No cuentan en tus meses hasta que los confirmes."
      : "Apagada. Las alertas que lleguen mientras tanto no se guardan."}</p>
    {cards.length > 0 && <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-body">Otros números de tus tarjetas</h3>
      <p className="text-small text-muted-foreground">Si el banco te dio una tarjeta virtual o te cambió el plástico, agrega sus últimos 4 dígitos para reconocer sus alertas.</p>
      {aliases.length > 0 && <ul className="flex flex-col gap-2">{aliases.map((alias) => {
        const card = cardOf(alias.cardId);
        return <li key={alias.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2 text-body">{card && <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cardColorClasses[card.color]}`} />}<span className="wrap-anywhere">{card?.name ?? "Tarjeta"} · •••• {alias.last4}</span></span>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeCardAlias(alias.id))}>Quitar<span className="sr-only"> •••• {alias.last4}</span></Button>
        </li>;
      })}</ul>}
      <form onSubmit={add} className="flex min-w-0 flex-wrap items-end gap-3">
        <div className="flex min-w-0 flex-1 basis-full flex-col gap-2 sm:basis-48"><Label htmlFor="alias-card">Tarjeta</Label><SelectControl id="alias-card" value={cardId} onValueChange={setCardId} disabled={pending} options={cards.map((card) => ({ value: card.id, label: `${card.name} · •••• ${card.last4}`, startAdornment: <span className={`size-2 rounded-full ${cardColorClasses[card.color]}`} /> }))} /></div>
        <div className="flex w-28 flex-col gap-2"><Label htmlFor="alias-last4">Últimos 4</Label><Input id="alias-last4" inputMode="numeric" autoComplete="off" maxLength={4} value={last4} onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))} disabled={pending} /></div>
        <Button type="submit" variant="outline" disabled={pending || last4.length !== 4}>Agregar</Button>
      </form>
    </div>}
    {error && <p role="alert" className="text-small text-danger">{error}</p>}
  </div>;
}
