"use server";

import { z } from "zod";

import { capturedChanges } from "@/lib/draft-form";
import { loadDraftProposal } from "@/lib/queries/drafts";
import { revalidateFinancialViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";
import { buildCreatePayload } from "@/lib/transaction-create";
import { transactionSchema } from "@/lib/validation/transaction";

const gone = "Este movimiento ya no está por confirmar.";

function databaseError(code: string | undefined, fallback: string): string {
  if (code === "P0002") return gone;
  return fallback;
}

/** F18: saves the real movement from the prefilled form and resolves the draft in one transaction (D47). */
export async function confirmDraft(draftId: unknown, input: unknown) {
  if (!z.uuid().safeParse(draftId).success || typeof draftId !== "string") return { ok: false as const, error: gone };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para guardar el movimiento." };
  const built = await buildCreatePayload(supabase, user.id, input);
  if (!built.ok) return { ...built, ok: false as const };
  // Step 45: names of the fields the owner corrected, never their values (D47). Unknown if the draft is no longer open.
  const proposal = await loadDraftProposal(supabase, user.id, draftId);
  const confirmed = transactionSchema.safeParse(input);
  const changed = proposal && confirmed.success ? capturedChanges(proposal, confirmed.data) : null;
  const { data, error } = await supabase.rpc("confirm_transaction_draft", { p_draft_id: draftId, p_payload: built.payload, p_changed_fields: changed ?? undefined });
  if (error || !data) return { ok: false as const, error: databaseError(error?.code, "No pudimos guardar el movimiento. Revisa la tarjeta y vuelve a intentarlo.") };
  revalidateFinancialViews();
  return { ok: true as const, id: String(data) };
}

/** "Es el mismo" (D46): links the draft to a registered movement without creating another one. */
export async function linkDraft(draftId: unknown, transactionId: unknown) {
  if (!z.uuid().safeParse(draftId).success || !z.uuid().safeParse(transactionId).success || typeof draftId !== "string" || typeof transactionId !== "string") {
    return { ok: false as const, error: gone };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { error } = await supabase.rpc("link_transaction_draft", { p_draft_id: draftId, p_transaction_id: transactionId });
  if (error?.code === "23505") return { ok: false as const, error: "Ese movimiento ya está enlazado a otro correo." };
  if (error?.code === "22023") return { ok: false as const, error: "Ese movimiento ya no coincide con el correo. Revisa sus datos." };
  if (error) return { ok: false as const, error: databaseError(error.code, "No pudimos enlazar el movimiento. Intenta de nuevo.") };
  revalidateFinancialViews();
  return { ok: true as const };
}

/** Discard keeps only the message identifier, so the same email is not captured again (D47). */
export async function discardDraft(draftId: unknown) {
  if (!z.uuid().safeParse(draftId).success || typeof draftId !== "string") return { ok: false as const, error: gone };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { error } = await supabase.rpc("discard_transaction_draft", { p_draft_id: draftId });
  if (error) return { ok: false as const, error: databaseError(error.code, "No pudimos descartar el movimiento. Intenta de nuevo.") };
  revalidateFinancialViews();
  return { ok: true as const };
}
