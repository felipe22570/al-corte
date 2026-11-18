"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { todayInBogota } from "@/lib/domain/dates";
import { paymentMonth } from "@/lib/domain/months";
import { revalidateFinancialViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";
import { statementCutoffFor } from "@/lib/domain/statements";
import { buildTransactionPlan } from "@/lib/domain/transaction-plan";
import { realTotalSchema, statementInterestSchema, statementPaymentDateSchema } from "@/lib/validation/statement";

function revalidateStatement(statement: { card_id: string; cutoff_date: string; due_date: string }) {
  revalidatePath(`/tarjetas/${statement.card_id}`);
  revalidatePath(`/tarjetas/${statement.card_id}/extractos/${statement.cutoff_date}`);
  revalidatePath(`/meses/${paymentMonth(statement.due_date)}`);
  revalidatePath("/");
  revalidateFinancialViews();
}

async function updateStatement(id: unknown, values: { real_total?: string | null; paid_at?: string | null }) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "El extracto no es válido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para actualizar el extracto." };
  const { data, error } = await supabase.from("statements").update(values).eq("id", id).eq("user_id", user.id).select("card_id,cutoff_date,due_date").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar el extracto." };
  revalidateStatement(data);
  return { ok: true as const };
}

export async function setStatementRealTotal(id: unknown, input: unknown) {
  const parsed = realTotalSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ingresa un total real válido." };
  return updateStatement(id, { real_total: parsed.data });
}

export async function markStatementPaid(id: unknown, input: unknown) {
  const parsed = statementPaymentDateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ingresa una fecha válida." };
  if (parsed.data > todayInBogota()) return { ok: false as const, error: "La fecha de pago no puede ser posterior a hoy." };
  return updateStatement(id, { paid_at: `${parsed.data}T05:00:00.000Z` });
}

export async function unmarkStatementPaid(id: unknown) {
  return updateStatement(id, { paid_at: null });
}

type InterestCard = { id: string; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: "fixed_principal" | "french"; interest_mode: "per_installment" | "on_balance" };

/** F11: registers the real interest of an on-balance statement as an `interest` charge dated on its cutoff. */
export async function recordStatementInterest(id: unknown, input: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "El extracto no es válido." };
  const parsed = statementInterestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa los intereses." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para registrar los intereses." };
  const { data: statement, error: statementError } = await supabase.from("statements").select("card_id,cutoff_date,due_date").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (statementError || !statement) return { ok: false as const, error: "El extracto ya no está disponible." };
  const { data, error: cardError } = await supabase.from("cards").select("id,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method,interest_mode").eq("id", statement.card_id).eq("user_id", user.id).is("archived_at", null).maybeSingle();
  if (cardError || !data) return { ok: false as const, error: "La tarjeta ya no está disponible." };
  const card = data as unknown as InterestCard;
  if (card.interest_mode !== "on_balance") return { ok: false as const, error: "Esta tarjeta cobra los intereses dentro de cada cuota." };
  // The charge is dated on the cutoff so R1 keeps it in this statement; a changed cutoff day (D10) would move it.
  if (statementCutoffFor(card.cutoff_day, statement.cutoff_date) !== statement.cutoff_date) return { ok: false as const, error: "La tarjeta cambió su día de corte. Registra los intereses como un movimiento." };
  const { payload } = buildTransactionPlan({
    cardId: card.id, type: "interest", date: statement.cutoff_date, amount: parsed.data.amount, currency: parsed.data.currency, fxRate: parsed.data.fxRate,
    installmentsCount: 1, interestFree: false, categoryId: null, merchant: "Intereses", note: "",
  }, { id: card.id, cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea, advanceRateEa: card.advance_rate_ea, advanceFee: card.advance_fee, amortizationMethod: card.amortization_method, interestMode: card.interest_mode });
  const { error } = await supabase.rpc("create_transaction_with_installments", { p_payload: payload });
  if (error) return { ok: false as const, error: "No pudimos registrar los intereses. Intenta de nuevo." };
  revalidateStatement(statement);
  return { ok: true as const };
}
