"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { buildTransactionPlan, type TransactionCard } from "@/lib/domain/transaction-plan";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validation/transaction";

type RawCard = { id: string; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: "fixed_principal" | "french" };

export async function createTransaction(input: unknown) {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos del movimiento.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para guardar el movimiento." };
  const { data, error: cardError } = await supabase.from("cards").select("id,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method").eq("id", parsed.data.cardId).eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (cardError || !data) return { ok: false as const, error: "La tarjeta ya no está disponible." };
  const raw = data as RawCard;
  const card: TransactionCard = { id: raw.id, cutoffDay: raw.cutoff_day, paymentDay: raw.payment_day, purchaseRateEa: raw.purchase_rate_ea, advanceRateEa: raw.advance_rate_ea, advanceFee: raw.advance_fee, amortizationMethod: raw.amortization_method };
  let payload;
  try {
    payload = buildTransactionPlan(parsed.data, card).payload;
  } catch {
    return { ok: false as const, error: "No pudimos calcular las cuotas. Revisa el valor y la cantidad." };
  }
  const { data: transactionId, error } = await supabase.rpc("create_transaction_with_installments", { p_payload: payload });
  if (error || !transactionId) return { ok: false as const, error: "No pudimos guardar el movimiento. Revisa la tarjeta y vuelve a intentarlo." };
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath(`/tarjetas/${card.id}`);
  return { ok: true as const, id: String(transactionId) };
}

export async function deleteTransaction(id: unknown) {
  if (!z.uuid().safeParse(id).success || typeof id !== "string") return { ok: false as const, error: "Movimiento no válido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para borrar el movimiento." };
  const { data, error: readError } = await supabase.from("transactions").select("type,parent_id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (readError || !data) return { ok: false as const, error: "El movimiento ya no está disponible." };
  if (data.type === "advance_fee" && data.parent_id) return { ok: false as const, error: "Borra la comisión desde su avance." };
  const { data: deleted, error } = await supabase.from("transactions").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !deleted) return { ok: false as const, error: "No pudimos borrar el movimiento. Intenta de nuevo." };
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath(`/movimientos/${id}`);
  return { ok: true as const };
}

export async function updateTransaction(id: unknown, input: unknown) {
  if (!z.uuid().safeParse(id).success || typeof id !== "string") return { ok: false as const, error: "Movimiento no válido." };
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa los datos del movimiento.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para editar el movimiento." };
  const [originalResult, cardResult] = await Promise.all([
    supabase.from("transactions").select("card_id,type,rate_ea_applied::text,parent_id").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("cards").select("id,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method").eq("id", parsed.data.cardId).eq("user_id", user.id).is("archived_at", null).maybeSingle(),
  ]);
  if (originalResult.error || !originalResult.data || cardResult.error || !cardResult.data) return { ok: false as const, error: "El movimiento o la tarjeta ya no están disponibles." };
  const original = originalResult.data as unknown as { card_id: string; type: string; rate_ea_applied: string | null; parent_id: string | null };
  if (original.type === "advance_fee" && original.parent_id) return { ok: false as const, error: "Edita la comisión desde su avance." };
  const raw = cardResult.data as RawCard;
  const card: TransactionCard = { id: raw.id, cutoffDay: raw.cutoff_day, paymentDay: raw.payment_day, purchaseRateEa: raw.purchase_rate_ea, advanceRateEa: raw.advance_rate_ea, advanceFee: raw.advance_fee, amortizationMethod: raw.amortization_method };
  let payload;
  try {
    const originalType = transactionSchema.shape.type.safeParse(original.type);
    payload = buildTransactionPlan(parsed.data, card, originalType.success ? { cardId: original.card_id, type: originalType.data, rateEaApplied: original.rate_ea_applied } : undefined).payload;
  } catch { return { ok: false as const, error: "No pudimos calcular las cuotas. Revisa el valor y la cantidad." }; }
  const { error } = await supabase.rpc("update_transaction_with_installments", { p_id: id, p_payload: payload });
  if (error) return { ok: false as const, error: "No pudimos actualizar el movimiento. Revisa los datos e intenta de nuevo." };
  revalidatePath("/"); revalidatePath("/movimientos"); revalidatePath(`/movimientos/${id}`);
  return { ok: true as const, id };
}
