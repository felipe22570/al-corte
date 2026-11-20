import Decimal from "decimal.js";
import { z } from "zod";
import { isValidIsoDate } from "@/lib/domain/dates";
import { parseColombianDecimal } from "@/lib/money-input";

function parseAmount(value: string, allowZero: boolean): Decimal | null {
  try {
    const parsed = new Decimal(parseColombianDecimal(value));
    if ((allowZero ? parsed.isNegative() : !parsed.gt(0)) || parsed.gt("999999999999.99")) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Payment of a statement in one currency (F14, D37). "Otro valor" needs the amount; the distribution of the prepayment
 * is optional (the proposal is used) and empty or zero rows are ignored (D38).
 */
export const paymentSchema = z.object({
  kind: z.enum(["minimum", "total", "other"], { error: "Elige cuánto pagaste." }),
  date: z.string().refine(isValidIsoDate, "Ingresa una fecha válida."),
  amount: z.string().max(100).default(""),
  effect: z.enum(["reduce_term", "reduce_installment"], { error: "Elige el efecto del abono." }).default("reduce_term"),
  note: z.string().trim().max(1000, "Usa máximo 1.000 caracteres.").default(""),
  distribution: z.array(z.object({ transactionId: z.uuid("La compra no es válida."), amount: z.string().max(100) })).max(500).optional(),
}).superRefine((value, ctx) => {
  if (value.kind === "other" && parseAmount(value.amount, false) === null) ctx.addIssue({ code: "custom", path: ["amount"], message: "Ingresa el valor que pagaste, mayor que cero." });
  value.distribution?.forEach((item, index) => {
    if (item.amount.trim() && parseAmount(item.amount, true) === null) ctx.addIssue({ code: "custom", path: ["distribution", index, "amount"], message: "Ingresa un abono válido." });
  });
}).transform((value) => ({
  kind: value.kind, date: value.date, effect: value.effect, note: value.note,
  amount: value.kind === "other" ? parseAmount(value.amount, false)! : null,
  distribution: value.distribution?.flatMap((item) => {
    const amount = item.amount.trim() ? parseAmount(item.amount, true)! : new Decimal(0);
    return amount.gt(0) ? [{ transactionId: item.transactionId, amount }] : [];
  }),
}));

export type PaymentInput = z.input<typeof paymentSchema>;
