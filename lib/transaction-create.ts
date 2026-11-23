import { z } from "zod";

import { buildTransactionPlan, type TransactionCard } from "@/lib/domain/transaction-plan";
import type { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validation/transaction";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawCard = { id: string; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: "fixed_principal" | "french"; interest_mode: "per_installment" | "on_balance" };
type PlanPayload = ReturnType<typeof buildTransactionPlan>["payload"];

export type CreatePayloadResult =
  | { ok: true; payload: PlanPayload }
  | { ok: false; error: string; errors?: Record<string, string[] | undefined> };

/**
 * Validates a new movement and computes its plan with the active card, as "Nuevo gasto" does. Shared by the expense form
 * and by the confirmation of a captured draft (F18), so both save exactly the same movement.
 */
export async function buildCreatePayload(supabase: Client, userId: string, input: unknown): Promise<CreatePayloadResult> {
  const parsed = transactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Revisa los datos del movimiento.", errors: z.flattenError(parsed.error).fieldErrors };
  const { data, error } = await supabase.from("cards").select("id,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method,interest_mode").eq("id", parsed.data.cardId).eq("user_id", userId).is("archived_at", null).maybeSingle();
  if (error || !data) return { ok: false, error: "La tarjeta ya no está disponible." };
  const raw = data as RawCard;
  const card: TransactionCard = { id: raw.id, cutoffDay: raw.cutoff_day, paymentDay: raw.payment_day, purchaseRateEa: raw.purchase_rate_ea, advanceRateEa: raw.advance_rate_ea, advanceFee: raw.advance_fee, amortizationMethod: raw.amortization_method, interestMode: raw.interest_mode };
  try {
    return { ok: true, payload: buildTransactionPlan(parsed.data, card).payload };
  } catch {
    return { ok: false, error: "No pudimos calcular las cuotas. Revisa el valor y la cantidad." };
  }
}
