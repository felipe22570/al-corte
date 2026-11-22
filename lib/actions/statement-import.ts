"use server";

import { MAX_IMPORT_BYTES } from "@/lib/import/monthly-file";
import { runMonthlyImport, type ImportRunResult } from "@/lib/import/run-monthly-import";
import { revalidateFinancialViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";

/**
 * Monthly import (F22): the file travels in the request, is read in memory and is never stored nor logged (D55). The
 * review and the save build everything again on the server; the browser only sends the file and the owner's decisions.
 */
async function run(formData: FormData, dryRun: boolean): Promise<ImportRunResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Elige el archivo del extracto." };
  if (file.size > MAX_IMPORT_BYTES) return { ok: false, error: "El archivo pesa más de 1 MB." };
  if (!file.name.toLowerCase().endsWith(".json")) return { ok: false, error: "Solo se aceptan archivos JSON." };
  let decisions: unknown;
  const rawDecisions = formData.get("decisions");
  if (typeof rawDecisions === "string" && rawDecisions) {
    try { decisions = JSON.parse(rawDecisions); } catch { return { ok: false, error: "Las decisiones de la revisión no son válidas." }; }
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Inicia sesión para importar el extracto." };
  try {
    return await runMonthlyImport(supabase, user.id, await file.text(), decisions, dryRun);
  } catch {
    return { ok: false, error: "No pudimos revisar el archivo. No se guardó nada." };
  }
}

export async function reviewStatementImport(formData: FormData): Promise<ImportRunResult> {
  return run(formData, true);
}

export async function saveStatementImport(formData: FormData): Promise<ImportRunResult> {
  const result = await run(formData, false);
  if (result.ok) revalidateFinancialViews();
  return result;
}
