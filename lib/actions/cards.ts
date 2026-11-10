"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { cardSchema, type ValidCard } from "@/lib/validation/card";

function databaseFields(card: ValidCard) {
  return {
    name: card.name, bank: card.bank, network: card.network, last4: card.last4,
    credit_limit: card.creditLimit, advance_fee: card.advanceFee, handling_fee: card.handlingFee,
    cutoff_day: card.cutoffDay, payment_day: card.paymentDay, purchase_rate_ea: card.purchaseRateEa,
    advance_rate_ea: card.advanceRateEa, amortization_method: card.amortizationMethod, color: card.color,
  };
}

export async function createCard(input: unknown) {
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos de la tarjeta.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para guardar la tarjeta." };
  const { error } = await supabase.from("cards").insert({ ...databaseFields(parsed.data), user_id: user.id });
  if (error) return { ok: false as const, error: "No pudimos guardar la tarjeta. Inténtalo de nuevo." };
  revalidatePath("/ajustes");
  return { ok: true as const };
}

export async function updateCard(id: string, input: unknown) {
  if (!z.uuid().safeParse(id).success) return { ok: false as const, error: "La tarjeta no es válida." };
  const parsed = cardSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos de la tarjeta.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para guardar la tarjeta." };
  const { data, error } = await supabase.from("cards").update(databaseFields(parsed.data)).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar la tarjeta." };
  revalidatePath("/ajustes");
  return { ok: true as const };
}

async function setCardArchived(id: string, archived: boolean) {
  if (!z.uuid().safeParse(id).success) return { ok: false as const, error: "La tarjeta no es válida." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { data, error } = await supabase.from("cards").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar la tarjeta." };
  revalidatePath("/ajustes");
  return { ok: true as const };
}

export async function archiveCard(id: string) { return setCardArchived(id, true); }
export async function unarchiveCard(id: string) { return setCardArchived(id, false); }
