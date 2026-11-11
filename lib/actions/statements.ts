"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { realTotalSchema, statementPaymentDateSchema } from "@/lib/validation/statement";

async function updateStatement(id: unknown, values: { real_total?: string | null; paid_at?: string | null }) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "El extracto no es válido." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para actualizar el extracto." };
  const { data, error } = await supabase.from("statements").update(values).eq("id", id).eq("user_id", user.id).select("card_id,cutoff_date").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar el extracto." };
  revalidatePath(`/tarjetas/${data.card_id}`);
  revalidatePath(`/tarjetas/${data.card_id}/extractos/${data.cutoff_date}`);
  revalidatePath("/");
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
  return updateStatement(id, { paid_at: `${parsed.data}T05:00:00.000Z` });
}

export async function unmarkStatementPaid(id: unknown) {
  return updateStatement(id, { paid_at: null });
}
