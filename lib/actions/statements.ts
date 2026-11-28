"use server";

import { z } from "zod";
import { todayInBogota } from "@/lib/domain/dates";
import { revalidateStatementViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";
import { effectiveAnnualRate, planBalanceCorrections } from "@/lib/domain/reconciliation";
import { loadCloseContext, type CloseContext } from "@/lib/queries/statement-close";
import { statementCloseSchema, statementPaymentDateSchema } from "@/lib/validation/statement";
import { currencySchema } from "@/lib/validation/transaction";

/** Bank values and payment mark live per statement and currency (D33); marking never creates a payment (D26). */
async function updateBalance(id: unknown, currency: unknown, values: { real_minimum?: string | null; real_total?: string | null; paid_at?: string | null }) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "El extracto no es válido." };
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!parsedCurrency.success) return { ok: false as const, error: "La moneda no es válida." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para actualizar el extracto." };
  const { data, error } = await supabase.from("statements").select("card_id,cutoff_date,due_date").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos actualizar el extracto." };
  const { error: balanceError } = await supabase.from("statement_balances")
    .upsert({ user_id: user.id, statement_id: id, currency: parsedCurrency.data, ...values }, { onConflict: "statement_id,currency" });
  if (balanceError) return { ok: false as const, error: "No pudimos actualizar el extracto." };
  revalidateStatementViews(data);
  return { ok: true as const };
}

export async function markStatementPaid(id: unknown, input: unknown, currency: unknown = "COP") {
  const parsed = statementPaymentDateSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Ingresa una fecha válida." };
  if (parsed.data > todayInBogota()) return { ok: false as const, error: "La fecha de pago no puede ser posterior a hoy." };
  return updateBalance(id, currency, { paid_at: `${parsed.data}T05:00:00.000Z` });
}

export async function unmarkStatementPaid(id: unknown, currency: unknown = "COP") {
  return updateBalance(id, currency, { paid_at: null });
}

/**
 * F15, D39: saves the bank values of one currency, its real interest, the rate in force and the bank balance of each
 * purchase (corrections planned by the domain), and optionally marks the currency as reconciled.
 */
export async function closeStatement(id: unknown, currency: unknown, input: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "El extracto no es válido." };
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!parsedCurrency.success) return { ok: false as const, error: "La moneda no es válida." };
  const parsed = statementCloseSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa los valores del extracto." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para cerrar el extracto." };
  let context: CloseContext | null;
  try {
    context = await loadCloseContext(supabase, user.id, id, parsedCurrency.data);
  } catch {
    return { ok: false as const, error: "No pudimos consultar el extracto. Intenta de nuevo." };
  }
  if (!context) return { ok: false as const, error: "El extracto ya no está disponible." };
  if (context.statement.cutoffDate >= todayInBogota()) return { ok: false as const, error: "El extracto aún no ha cortado." };
  const values = parsed.data;
  const usdCharges = parsedCurrency.data === "USD" && (values.interest?.gt(0) || values.lateInterest?.gt(0));
  if (usdCharges && !context.fxRate) return { ok: false as const, error: "Falta la TRM para registrar intereses en dólares." };
  let planned: ReturnType<typeof planBalanceCorrections>;
  try {
    planned = planBalanceCorrections({ purchases: context.purchases, entered: new Map(values.balances.map((item) => [item.transactionId, item.bankBalance])), statementCutoff: context.statement.cutoffDate, cutoffDay: context.card.cutoffDay });
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Revisa los saldos de las compras." };
  }
  const { error } = await supabase.rpc("close_statement", { p_payload: {
    statement_id: id, currency: parsedCurrency.data, real_minimum: values.realMinimum?.toFixed() ?? null, real_total: values.realTotal?.toFixed() ?? null,
    rate_ea: values.rate ? effectiveAnnualRate(values.rate, values.rateUnit).toFixed() : null,
    interest: values.interest?.toFixed() ?? null, late_interest: values.lateInterest?.toFixed() ?? null,
    fx_rate: parsedCurrency.data === "USD" && context.fxRate ? context.fxRate.toFixed() : null,
    corrections: planned.corrections, remove_corrections: planned.remove, reconcile: values.reconcile,
  } });
  // R9: corrections are undone last in, first out, like prepayments.
  if (error?.message.includes("pago más reciente")) return { ok: false as const, error: "Esa compra recibió un abono después de este extracto. Borra ese pago antes de cambiar su saldo." };
  if (error?.message.includes("varios intereses")) return { ok: false as const, error: "El extracto tiene varios cargos de intereses. Corrígelos desde movimientos." };
  if (error) return { ok: false as const, error: "No pudimos guardar el cierre. Revisa los valores e intenta de nuevo." };
  revalidateStatementViews({ card_id: context.statement.cardId, cutoff_date: context.statement.cutoffDate, due_date: context.statement.dueDate });
  return { ok: true as const };
}

/** D39: reopening removes only the reconciliation mark; bank values and corrections stay. */
export async function reopenStatement(id: unknown, currency: unknown) {
  if (typeof id !== "string" || !z.uuid().safeParse(id).success) return { ok: false as const, error: "El extracto no es válido." };
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!parsedCurrency.success) return { ok: false as const, error: "La moneda no es válida." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para reabrir el extracto." };
  const { data: statement } = await supabase.from("statements").select("card_id,cutoff_date,due_date").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!statement) return { ok: false as const, error: "El extracto ya no está disponible." };
  const { error } = await supabase.rpc("reopen_statement", { p_statement_id: id, p_currency: parsedCurrency.data });
  if (error) return { ok: false as const, error: "No pudimos reabrir el extracto. Intenta de nuevo." };
  revalidateStatementViews(statement);
  return { ok: true as const };
}
