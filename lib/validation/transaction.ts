import Decimal from "decimal.js";
import { z } from "zod";
import { isValidIsoDate } from "@/lib/domain/dates";
import { parseColombianDecimal } from "@/lib/money-input";

const amount = z.string().transform((value, ctx) => {
  try {
    const parsed = parseColombianDecimal(value);
    if (!new Decimal(parsed).gt(0) || new Decimal(parsed).gt("999999999999.99")) throw new Error("Fuera de rango");
    return parsed;
  } catch {
    ctx.addIssue({ code: "custom", message: "Ingresa un valor mayor que cero y dentro del rango permitido." });
    return z.NEVER;
  }
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

export const transactionSchema = z.object({
  cardId: z.uuid("Elige una tarjeta válida."),
  type: z.enum(["purchase", "cash_advance", "payment", "handling_fee", "interest", "insurance", "refund", "adjustment"], { error: "Elige un tipo de movimiento." }),
  date: z.string().refine(isValidIsoDate, "Ingresa una fecha válida."),
  amount,
  currency: z.enum(["COP", "USD"], { error: "Elige una moneda." }),
  fxRate,
  installmentsCount: z.coerce.number().int("Ingresa un número entero.").min(1, "Elige entre 1 y 36 cuotas.").max(36, "Elige entre 1 y 36 cuotas."),
  interestFree: z.boolean().default(false),
  categoryId: z.union([z.uuid("Elige una categoría válida."), z.literal("")]).default("").transform((value) => value || null),
  merchant: z.string().trim().max(200, "Usa máximo 200 caracteres.").default(""),
  note: z.string().trim().max(1000, "Usa máximo 1.000 caracteres.").default(""),
}).superRefine((value, ctx) => {
  if (value.currency === "USD" && !value.fxRate) ctx.addIssue({ code: "custom", path: ["fxRate"], message: "Ingresa la TRM para movimientos en dólares." });
  if (value.currency === "COP" && value.fxRate) ctx.addIssue({ code: "custom", path: ["fxRate"], message: "La TRM solo aplica a movimientos en dólares." });
  if (value.type !== "purchase" && value.type !== "cash_advance" && value.installmentsCount !== 1) ctx.addIssue({ code: "custom", path: ["installmentsCount"], message: "Solo las compras y los avances pueden tener cuotas." });
  if (value.type !== "purchase" && value.interestFree) ctx.addIssue({ code: "custom", path: ["interestFree"], message: "La opción sin intereses solo aplica a compras." });
});

export type TransactionInput = z.input<typeof transactionSchema>;
export type ValidTransaction = z.output<typeof transactionSchema>;
