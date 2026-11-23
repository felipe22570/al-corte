"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { discardDraft, linkDraft } from "@/lib/actions/drafts";

export type DraftCandidateOption = { id: string; label: string };

/**
 * Actions of a captured draft (F18): confirm in the prefilled form, link it to the same registered movement (D46) or
 * discard it. Secondary buttons only: the inbox can list many drafts.
 */
export function DraftActions({ draftId, name, candidates }: { draftId: string; name: string; candidates: DraftCandidateOption[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, notice: string) {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (!result.ok) { setError(result.error ?? "No pudimos completar la acción. Intenta de nuevo."); return; }
      router.replace(`/por-confirmar?notice=${notice}`);
      router.refresh();
    } catch {
      setError("No pudimos completar la acción. Intenta de nuevo.");
    } finally { setBusy(false); }
  }

  function discard() {
    if (!window.confirm(`Se descarta ${name}. No volverá a aparecer aunque el correo llegue otra vez. ¿Quieres continuar?`)) return;
    void run(() => discardDraft(draftId), "discarded");
  }

  return <div className="flex min-w-0 flex-col gap-2">
    {candidates.map((candidate) => <div key={candidate.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
      <p className="min-w-0 text-small text-muted-foreground wrap-anywhere">Ya tienes uno igual: {candidate.label}</p>
      <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void run(() => linkDraft(draftId, candidate.id), "linked")}>
        Es el mismo<span className="sr-only">: {candidate.label}</span>
      </Button>
    </div>)}
    <div className="flex flex-wrap gap-2">
      <Link href={`/movimientos/nuevo?borrador=${draftId}`} aria-disabled={busy} className={buttonVariants({ variant: "outline", size: "sm" })}>Confirmar<span className="sr-only"> {name}</span></Link>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={discard}>Descartar<span className="sr-only"> {name}</span></Button>
    </div>
    {error && <p role="alert" className="text-small text-danger">{error}</p>}
  </div>;
}
