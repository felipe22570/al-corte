"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayInBogota } from "@/lib/domain/dates";
import { chargeDatesBetween } from "@/lib/domain/subscriptions";
import { createClient } from "@/lib/supabase/server";
import { subscriptionSchema, type ValidSubscription } from "@/lib/validation/subscription";

function fields(value: ValidSubscription) {
  return { name: value.name, card_id: value.cardId, category_id: value.categoryId, amount: value.amount, currency: value.currency, frequency: value.frequency, billing_day: value.billingDay, start_date: value.startDate, trial_ends_at: value.trialEndsAt };
}
function refresh(cardId: string) {
  revalidatePath("/suscripciones"); revalidatePath("/movimientos"); revalidatePath(`/tarjetas/${cardId}`); revalidatePath("/");
}

export async function createSubscription(input: unknown) {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos de la suscripción.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para guardar la suscripción." };
  const { data: card, error: cardError } = await supabase.from("cards").select("id").eq("id", parsed.data.cardId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (cardError || !card) return { ok: false as const, error: "La tarjeta ya no está disponible." };
  if (parsed.data.categoryId) {
    const { data: category, error } = await supabase.from("categories").select("id").eq("id", parsed.data.categoryId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
    if (error || !category) return { ok: false as const, error: "La categoría ya no está disponible." };
  }
  const { data, error } = await supabase.from("subscriptions").insert({ ...fields(parsed.data), user_id: user.id }).select("id").single();
  if (error || !data) return { ok: false as const, error: "No pudimos guardar la suscripción." };
  const { data: generated, error: chargeError } = await supabase.rpc("generate_charges_for_subscription", { p_id: data.id });
  const today = todayInBogota();
  const dueToday = chargeDatesBetween({ startDate: parsed.data.startDate, frequency: parsed.data.frequency, billingDay: parsed.data.billingDay, trialEndsAt: parsed.data.trialEndsAt, status: "active" }, today, today).length > 0;
  let chargeMissing = false;
  if (!chargeError && dueToday && generated === 0) {
    const result = await supabase.from("transactions").select("id").eq("subscription_id", data.id).eq("user_id", user.id).eq("date", today).maybeSingle();
    chargeMissing = !!result.error || !result.data;
  }
  refresh(parsed.data.cardId);
  return { ok: true as const, id: data.id, warning: chargeError || chargeMissing ? "La suscripción se guardó, pero no se generó el cobro de hoy. Revisa la tarjeta y la TRM; la tarea diaria lo intentará de nuevo." : null };
}

export async function updateSubscription(id: unknown, input: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "La suscripción no es válida." };
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos de la suscripción.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para guardar la suscripción." };
  const { data: card, error: cardError } = await supabase.from("cards").select("id").eq("id", parsed.data.cardId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (cardError || !card) return { ok: false as const, error: "La tarjeta ya no está disponible." };
  if (parsed.data.categoryId) {
    const { data: category, error } = await supabase.from("categories").select("id").eq("id", parsed.data.categoryId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
    if (error || !category) return { ok: false as const, error: "La categoría ya no está disponible." };
  }
  const { data, error } = await supabase.from("subscriptions").update(fields(parsed.data)).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar la suscripción." };
  refresh(parsed.data.cardId);
  return { ok: true as const, id: data.id, warning: null };
}

export async function setSubscriptionStatus(id: unknown, status: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success || !z.enum(["active", "paused", "cancelled"]).safeParse(status).success) return { ok: false as const, error: "La suscripción no es válida." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { data, error } = await supabase.from("subscriptions").update({ status: status as "active" | "paused" | "cancelled" }).eq("id", id).eq("user_id", user.id).select("card_id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar la suscripción." };
  refresh(data.card_id);
  return { ok: true as const };
}
