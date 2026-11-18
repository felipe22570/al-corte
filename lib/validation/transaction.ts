import Decimal from "decimal.js";
import { z } from "zod";
import { isValidIsoDate } from "@/lib/domain/dates";
import { MAX_PLAN_INSTALLMENTS } from "@/lib/domain/installments";
import type { TransactionInProgress } from "@/lib/domain/transaction-plan";
import { parseColombianDecimal } from "@/lib/money-input";

function parseMoney(value: string, allowZero: boolean): string | null {
  try {
    const parsed = new Decimal(parseColombianDecimal(value));
    if ((allowZero ? parsed.isNegative() : !parsed.gt(0)) || parsed.gt("999999999999.99")) return null;
    return parsed.toFixed();
  } catch {
    return null;
  }
}

const amount = z.string().transform((value, ctx) => {
  const parsed = parseMoney(value, false);
  if (parsed === null) {
    ctx.addIssue({ code: "custom", message: "Ingresa un valor mayor que cero y dentro del rango permitido." });
    return z.NEVER;
  }
  return parsed;
});
const fxRate = z.string().default("").transform((value, ctx) => {
  if (!value.trim()) return null;
  try {
    const parsed = parseColombianDecimal(value, 4);
    if (!new Decimal(parsed).gt(0) || new Decimal(parsed).gt("99999999.9999")) throw new Error("Fuera de rango");
    return parsed;
  } catch {
    ctx.addIssue({ code: "custom", message: "Ingresa una TRM válida mayor que cero." });
    return z.NEVER;
  }
});

export const transactionTypeSchema = z.enum(["purchase", "cash_advance", "payment", "handling_fee", "interest", "insurance", "refund", "adjustment"], { error: "Elige un tipo de movimiento." });
export const currencySchema = z.enum(["COP", "USD"], { error: "Elige una moneda." });

export const transactionSchema = z.object({
  cardId: z.uuid("Elige una tarjeta válida."),
  type: transactionTypeSchema,
  date: z.string().refine(isValidIsoDate, "Ingresa una fecha válida."),
  amount,
  currency: currencySchema,
  fxRate,
  installmentsCount: z.coerce.number().int("Ingresa un número entero.").min(1, "Elige entre 1 y 36 cuotas.").max(36, "Elige entre 1 y 36 cuotas."),
  interestFree: z.boolean().default(false),
  categoryId: z.union([z.uuid("Elige una categoría válida."), z.literal("")]).default("").transform((value) => value || null),
  merchant: z.string().trim().max(200, "Usa máximo 200 caracteres.").default(""),
  note: z.string().trim().max(1000, "Usa máximo 1.000 caracteres.").default(""),
  // In-progress purchase (F10, D49): installment k and the balance after it, copied from the last bank statement.
  inProgress: z.boolean().default(false),
  currentInstallment: z.string().max(10).default(""),
  balanceAfter: z.string().max(100).default(""),
  trackedFromCutoff: z.string().max(10).default(""),
}).superRefine((value, ctx) => {
  if (value.currency === "USD" && !value.fxRate) ctx.addIssue({ code: "custom", path: ["fxRate"], message: "Ingresa la TRM para movimientos en dólares." });
  if (value.currency === "COP" && value.fxRate) ctx.addIssue({ code: "custom", path: ["fxRate"], message: "La TRM solo aplica a movimientos en dólares." });
  if (value.type !== "purchase" && value.type !== "cash_advance" && value.installmentsCount !== 1) ctx.addIssue({ code: "custom", path: ["installmentsCount"], message: "Solo las compras y los avances pueden tener cuotas." });
  if (value.type !== "purchase" && value.interestFree) ctx.addIssue({ code: "custom", path: ["interestFree"], message: "La opción sin intereses solo aplica a compras." });
  if (!value.inProgress) return;
  if ((value.type !== "purchase" && value.type !== "cash_advance") || value.installmentsCount < 2) {
    ctx.addIssue({ code: "custom", path: ["inProgress"], message: "Las cuotas ya pagadas solo aplican a compras o avances a varias cuotas." });
  }
  const hasBalance = value.balanceAfter.trim() !== "";
  const current = /^\d{1,2}$/.test(value.currentInstallment.trim()) ? Number(value.currentInstallment.trim()) : NaN;
  // Without the bank balance, k cannot exceed N. With it, the effective plan may be longer, up to 72 (D50).
  const max = hasBalance ? MAX_PLAN_INSTALLMENTS : value.installmentsCount;
  if (!(current >= 2 && current <= max)) ctx.addIssue({ code: "custom", path: ["currentInstallment"], message: `Ingresa la cuota de tu último extracto, entre 2 y ${max}.` });
  if (hasBalance && parseMoney(value.balanceAfter, true) === null) ctx.addIssue({ code: "custom", path: ["balanceAfter"], message: "Ingresa el saldo como aparece en el extracto, por ejemplo 112.965." });
  if (!isValidIsoDate(value.trackedFromCutoff)) ctx.addIssue({ code: "custom", path: ["trackedFromCutoff"], message: "Elige el extracto de esa cuota." });
}).transform(({ inProgress, currentInstallment, balanceAfter, trackedFromCutoff, ...transaction }) => ({
  ...transaction,
  inProgress: inProgress ? {
    currentInstallment: Number(currentInstallment.trim()),
    balanceAfter: balanceAfter.trim() ? parseMoney(balanceAfter, true) : null,
    trackedFromCutoff,
  } satisfies TransactionInProgress : null,
}));

export type TransactionInput = z.input<typeof transactionSchema>;
export type ValidTransaction = z.output<typeof transactionSchema>;
