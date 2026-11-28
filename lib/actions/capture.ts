"use server";

import { z } from "zod";

import { revalidateCaptureViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";

const aliasSchema = z.object({
  cardId: z.uuid("Elige una tarjeta."),
  last4: z.string().trim().regex(/^\d{4}$/, "Escribe los últimos 4 dígitos."),
});

/** D51: Ajustes only turns capture on or off; the secret and the owner live in server variables. */
export async function setCaptureEnabled(enabled: unknown) {
  if (typeof enabled !== "boolean") return { ok: false as const, error: "Valor no válido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { error } = await supabase.from("capture_settings").upsert({ user_id: user.id, enabled }, { onConflict: "user_id" });
  if (error) return { ok: false as const, error: "No pudimos cambiar la captura. Intenta de nuevo." };
  revalidateCaptureViews();
  return { ok: true as const };
}

/** Other last 4 digits of a card, for virtual or reissued cards (D44). */
export async function addCardAlias(input: unknown) {
  const parsed = aliasSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { data: card, error: cardError } = await supabase.from("cards").select("last4").eq("id", parsed.data.cardId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (cardError || !card) return { ok: false as const, error: "La tarjeta ya no está disponible." };
  if ((card as { last4: string }).last4 === parsed.data.last4) return { ok: false as const, error: "La tarjeta ya termina en esos dígitos." };
  const { error } = await supabase.from("card_aliases").insert({ user_id: user.id, card_id: parsed.data.cardId, last4: parsed.data.last4 });
  if (error) return { ok: false as const, error: error.code === "23505" ? "Esos dígitos ya están asignados a una tarjeta." : "No pudimos guardar los dígitos. Intenta de nuevo." };
  revalidateCaptureViews();
  return { ok: true as const };
}

export async function removeCardAlias(id: unknown) {
  if (!z.uuid().safeParse(id).success || typeof id !== "string") return { ok: false as const, error: "Dígitos no válidos." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { data, error } = await supabase.from("card_aliases").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos quitar los dígitos. Intenta de nuevo." };
  revalidateCaptureViews();
  return { ok: true as const };
}
