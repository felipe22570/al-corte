"use client";

import { useState, useTransition } from "react";
import { archiveCard, unarchiveCard } from "@/lib/actions/cards";
import { archiveCategory } from "@/lib/actions/categories";
import { Button } from "@/components/ui/button";

export function ArchiveButton({ id, kind, archived = false }: { id: string; kind: "card" | "category"; archived?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function onClick() {
    if (!archived && !window.confirm(`¿Quieres archivar ${kind === "card" ? "esta tarjeta" : "esta categoría"}?`)) return;
    startTransition(async () => {
      setError(""); setMessage("");
      try {
        const result = kind === "category" ? await archiveCategory(id) : archived ? await unarchiveCard(id) : await archiveCard(id);
        if (!result.ok) setError(result.error); else setMessage(archived ? "Restaurada." : "Archivada.");
      } catch { setError("No pudimos actualizar el elemento. Intenta de nuevo."); }
    });
  }
  return <div className="flex flex-col items-start gap-2"><Button type="button" variant="ghost" onClick={onClick} disabled={pending}>{pending ? "Guardando…" : archived ? "Restaurar" : "Archivar"}</Button>{message && <p role="status" className="text-small text-muted-foreground">{message}</p>}{error && <p role="alert" className="text-small text-danger">{error}</p>}</div>;
}
