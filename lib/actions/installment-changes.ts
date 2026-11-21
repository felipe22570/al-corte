"use server";

import { z } from "zod";
import { todayInBogota } from "@/lib/domain/dates";
import { changeInstallments, installmentChangePayload } from "@/lib/domain/installment-changes";
import type { InstallmentChangePreview } from "@/lib/installment-change-types";
import { loadPlanTarget, type PlanTargetContext } from "@/lib/queries/plan-target";
import { revalidateFinancialViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";
import { installmentChangeSchema } from "@/lib/validation/installment-change";

async function prepare(id: unknown, input: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "La compra no es válida." };
  const parsed = installmentChangeSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa las cuotas." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para cambiar las cuotas." };
  let context: PlanTargetContext | null;
  try {
    context = await loadPlanTarget(supabase, user.id, id);
  } catch {
    return { ok: false as const, error: "No pudimos consultar la compra. Intenta de nuevo." };
  }
  if (!context) return { ok: false as const, error: "La compra ya no está disponible." };
  try {
    const change = changeInstallments({ target: context.target, remaining: parsed.data.remaining, date: todayInBogota(), cutoffDay: context.cutoffDay, interestRate: context.interestRate });
    return { ok: true as const, supabase, change, remaining: parsed.data.remaining };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "No pudimos calcular las cuotas." };
  }
}

/** F16: new installment, effective plan and estimated interest difference before saving (D40). */
export async function previewInstallmentChange(id: unknown, input: unknown): Promise<{ ok: true; preview: InstallmentChangePreview } | { ok: false; error: string }> {
  const prepared = await prepare(id, input);
  if (!prepared.ok) return prepared;
  const { change } = prepared;
  return { ok: true, preview: {
    pending: change.pending.toFixed(), nextInstallment: change.nextInstallment.toFixed(), previousInstallment: change.previousInstallment.toFixed(), effectivePlan: change.effectivePlan,
    interestBefore: change.interestBefore.toFixed(), interestAfter: change.interestAfter.toFixed(), interestDifference: change.interestDifference.toFixed(),
  } };
}

/** F16, D40, D50: rebuilds the unbilled installments with the new number of installments left. */
export async function changeInstallmentsAction(id: unknown, input: unknown) {
  const prepared = await prepare(id, input);
  if (!prepared.ok) return prepared;
  const { error } = await prepared.supabase.rpc("change_installments", { p_payload: installmentChangePayload(id as string, prepared.remaining, prepared.change) });
  if (error) return { ok: false as const, error: "No pudimos cambiar las cuotas. Revisa los datos e intenta de nuevo." };
  revalidateFinancialViews();
  return { ok: true as const };
}

/** Undoes the latest installment change of a purchase; the database restores the installments it replaced (last in, first out). */
export async function undoInstallmentChange(changeId: unknown) {
  if (typeof changeId !== "string" || !z.uuid().safeParse(changeId).success) return { ok: false as const, error: "El cambio no es válido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para deshacer el cambio." };
  const { data, error } = await supabase.from("principal_prepayments").delete().eq("id", changeId).eq("user_id", user.id).not("remaining_installments", "is", null).select("id").maybeSingle();
  if (error?.message.includes("pago más reciente")) return { ok: false as const, error: "La compra tiene un abono o un saldo del banco posterior. Deshazlo primero." };
  if (error || !data) return { ok: false as const, error: "No pudimos deshacer el cambio. Intenta de nuevo." };
  revalidateFinancialViews();
  return { ok: true as const };
}
