"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { ImportReview } from "@/components/import-review";
import { ImportVerification } from "@/components/import-verification";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { reviewStatementImport, saveStatementImport } from "@/lib/actions/statement-import";
import type { ImportDecision } from "@/lib/import/monthly-review";
import type { ImportRunResult } from "@/lib/import/run-monthly-import";
import { formatDateShort } from "@/lib/format";

type Done = Extract<ImportRunResult, { ok: true }>;

/**
 * F22: monthly import from Ajustes. The file stays in the browser and travels again on each review and on saving; the
 * server never stores it. The preview runs the same RPC as the save and undoes it (D55).
 */
export function StatementImport({ today }: { today: string }) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Done | null>(null);
  const [saved, setSaved] = useState<Done | null>(null);
  const [decisions, setDecisions] = useState<Record<string, ImportDecision>>({});
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function send(action: typeof reviewStatementImport, chosen: Record<string, ImportDecision>, done: (result: Done) => void) {
    if (!file) { setError("Elige el archivo del extracto."); return; }
    const data = new FormData();
    data.set("file", file);
    data.set("decisions", JSON.stringify(chosen));
    setError("");
    startTransition(async () => {
      let result: ImportRunResult;
      try { result = await action(data); } catch { result = { ok: false, error: "No pudimos revisar el archivo. No se guardó nada." }; }
      if (!result.ok) { setError(result.error); return; }
      done(result);
    });
  }
  const review = () => send(reviewStatementImport, {}, (result) => { setPreview(result); setDecisions(result.decisions); setSaved(null); });
  const decide = (key: string, decision: ImportDecision) => {
    const chosen = { ...decisions, [key]: decision };
    setDecisions(chosen);
    send(reviewStatementImport, chosen, (result) => setPreview(result));
  };
  const save = () => send(saveStatementImport, decisions, (result) => setSaved(result));
  function reset() {
    setFile(null); setPreview(null); setSaved(null); setDecisions({}); setError("");
    if (input.current) input.current.value = "";
  }

  const cards = Object.fromEntries((preview?.review.statements ?? []).map((item) => [item.cardId, { name: item.cardName, last4: item.last4 }]));
  const toCreate = preview ? Object.values(decisions).filter((decision) => decision === "import").length : 0;
  const toLink = preview ? Object.values(decisions).filter((decision) => decision === "link").length : 0;

  if (saved) {
    return <div className="flex min-w-0 flex-col gap-6">
      <p role="status" className="text-body">{saved.created === 1 ? "Importaste 1 movimiento" : `Importaste ${saved.created} movimientos`}{saved.linked ? ` y enlazaste ${saved.linked}` : ""}.</p>
      <ImportVerification title="Verificación después de guardar" statements={saved.review.statements} verification={saved.verification} today={today} />
      <div className="flex flex-col gap-2">{saved.review.statements.map((item) => <Link key={`${item.cardId}:${item.cutoffDate}`} className="w-fit text-body underline pointer-coarse:min-h-11" href={`/tarjetas/${item.cardId}/extractos/${item.cutoffDate}#cierre`}>Hacer el cierre del corte del {formatDateShort(item.cutoffDate, today)} · •••• {item.last4}</Link>)}</div>
      <div><Button type="button" variant="outline" onClick={reset}>Importar otro archivo</Button></div>
    </div>;
  }

  return <div className="flex min-w-0 flex-col gap-6">
    <div className="flex flex-col gap-2">
      <Label htmlFor={inputId}>Archivo del extracto</Label>
      <input ref={input} id={inputId} type="file" accept="application/json,.json" disabled={pending} aria-describedby={`${inputId}-help`}
        className="w-full min-w-0 rounded-md border border-input bg-card p-2 text-body file:mr-3 file:rounded-sm file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-body file:text-foreground"
        onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreview(null); setError(""); }} />
      <p id={`${inputId}-help`} className="text-small text-muted-foreground">Un archivo al-corte-import v1 de hasta 1 MB. Se lee para revisarlo y no se guarda.</p>
      <div><Button type="button" variant={preview ? "outline" : "default"} disabled={!file || pending} onClick={review}>{pending && !preview ? "Revisando…" : "Revisar archivo"}</Button></div>
    </div>
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    {preview && <>
      {preview.review.warnings.length > 0 && <Alert><AlertDescription><ul className="grid gap-1">{preview.review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></AlertDescription></Alert>}
      <ImportReview rows={preview.review.rows} decisions={decisions} onDecision={decide} cards={cards} today={today} disabled={pending} />
      <ImportVerification title="Verificación antes de guardar" statements={preview.review.statements} verification={preview.verification} today={today} />
      {pending && <p role="status" className="text-small text-muted-foreground">Actualizando la verificación…</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" disabled={pending || (toCreate === 0 && toLink === 0)} onClick={save}>Guardar importación</Button>
        <Button type="button" variant="outline" disabled={pending} onClick={reset}>Cancelar</Button>
        <p className="text-small text-muted-foreground">{toCreate === 1 ? "1 movimiento nuevo" : `${toCreate} movimientos nuevos`}{toLink ? ` · ${toLink} por enlazar` : ""}</p>
      </div>
    </>}
  </div>;
}
