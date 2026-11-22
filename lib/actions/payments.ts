"use server";

import { z } from "zod";
import { todayInBogota } from "@/lib/domain/dates";
import { buildPaymentPlan, paymentDateError, paymentPayload, roundUpToUnit, type PrepaymentTargetType } from "@/lib/domain/payments";
import { formatDateShort } from "@/lib/format";
import type { PaymentPreview } from "@/lib/payment-types";
import { loadPaymentContext, type PaymentContext } from "@/lib/queries/payments";
import { revalidateFinancialViews } from "@/lib/revalidate-views";
import { createClient } from "@/lib/supabase/server";
import { paymentSchema } from "@/lib/validation/payment";
import { currencySchema } from "@/lib/validation/transaction";

type Parsed = z.output<typeof paymentSchema>;
const typeLabels: Record<PrepaymentTargetType, string> = { purchase: "Compra", cash_advance: "Avance", advance_fee: "Comisión de avance", adjustment: "Ajuste" };

async function prepare(statementId: unknown, currency: unknown, input: unknown) {
  if (typeof statementId !== "string" || !z.uuid().safeParse(statementId).success) return { ok: false as const, error: "El extracto no es válido." };
  const parsedCurrency = currencySchema.safeParse(currency);
  if (!parsedCurrency.success) return { ok: false as const, error: "La moneda no es válida." };
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Revisa los datos del pago." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para registrar el pago." };
  let context: PaymentContext | null;
  try {
    context = await loadPaymentContext(supabase, user.id, statementId, parsedCurrency.data);
  } catch {
    return { ok: false as const, error: "No pudimos consultar el extracto. Intenta de nuevo." };
  }
  if (!context) return { ok: false as const, error: "El extracto ya no está disponible." };
  const dateError = paymentDateError(parsed.data.kind, parsed.data.date, context.statement, todayInBogota());
  if (dateError) return { ok: false as const, error: dateError };
  return { ok: true as const, supabase, context, data: parsed.data };
}

function plan(context: PaymentContext, data: Parsed, kind = data.kind) {
  return buildPaymentPlan({
    kind, currency: context.currency, date: data.date, statementCutoff: context.statement.cutoffDate, pending: context.pending,
    amount: data.amount ?? undefined, targets: context.targets, rule: context.card.rule, effect: data.effect, distribution: kind === data.kind ? data.distribution : undefined,
  });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "No pudimos calcular el pago. Revisa los datos.";
}

/** F14: what the payment covers and the proposed distribution of its prepayment, before saving (D38). */
export async function previewPayment(statementId: unknown, currency: unknown, input: unknown): Promise<{ ok: true; preview: PaymentPreview } | { ok: false; error: string }> {
  const prepared = await prepare(statementId, currency, input);
  if (!prepared.ok) return prepared;
  const { context, data } = prepared;
  let result: ReturnType<typeof buildPaymentPlan>;
  try {
    result = plan(context, data);
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  let totalAmount: string | null = null;
  try {
    if (!paymentDateError("total", data.date, context.statement, todayInBogota())) totalAmount = plan(context, data, "total").amount.toFixed();
  } catch {
    totalAmount = null;
  }
  const today = todayInBogota();
  const position = new Map(result.prepayments.map((prepayment, index) => [prepayment.transactionId, index]));
  const order = (id: string) => position.get(id) ?? result.prepayments.length;
  return { ok: true, preview: {
    kind: data.kind, currency: context.currency, rule: context.card.rule, effect: data.effect,
    amount: result.amount.toFixed(), pending: context.pending.toFixed(), minimumAmount: context.pending.gt(0) ? roundUpToUnit(context.pending).toFixed() : null, totalAmount,
    toMinimum: result.toMinimum.toFixed(), coversMinimum: result.coversMinimum, prepayable: result.prepayable.toFixed(), allocatable: result.allocatable.toFixed(), leftover: result.leftover.toFixed(),
    // The proposal's order first (the bank's order), then the rest by date.
    candidates: [...result.candidates].sort((a, b) => order(a.id) - order(b.id) || a.date.localeCompare(b.date)).map((candidate) => {
      const label = context.labels.get(candidate.id)!;
      return { id: candidate.id, label: label.merchant || typeLabels[label.type], pending: candidate.pending.toFixed(),
        detail: `${typeLabels[label.type]} del ${formatDateShort(label.date, today)} · ${label.installmentsCount > 1 ? `${label.installmentsCount} cuotas` : "1 cuota"}` };
    }),
    prepayments: result.prepayments.map((prepayment) => ({
      transactionId: prepayment.transactionId, amount: prepayment.amount.toFixed(), assumed: prepayment.assumed,
      remainingInstallments: prepayment.rows ? prepayment.rows.length : null, nextInstallment: prepayment.rows?.[0]?.total.toFixed() ?? null,
    })),
  } };
}

/** F14, D37, D38: registers the payment, its prepayments and rebuilt installments, and the payment mark when it covers the minimum. */
export async function registerPayment(statementId: unknown, currency: unknown, input: unknown) {
  const prepared = await prepare(statementId, currency, input);
  if (!prepared.ok) return prepared;
  const { supabase, context, data } = prepared;
  let payload: ReturnType<typeof paymentPayload>;
  try {
    const result = plan(context, data);
    payload = paymentPayload({ cardId: context.card.id, statementId: context.statement.id, currency: context.currency, kind: data.kind, date: data.date, fxRate: context.fxRate, note: data.note, copDebited: data.copDebited }, result);
  } catch (error) {
    return { ok: false as const, error: errorMessage(error) };
  }
  const { error } = await supabase.rpc("register_payment", { p_payload: payload });
  if (error) return { ok: false as const, error: "No pudimos registrar el pago. Revisa los datos e intenta de nuevo." };
  revalidateFinancialViews();
  return { ok: true as const, markedPaid: payload.mark_paid };
}
