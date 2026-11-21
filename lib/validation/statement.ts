import Decimal from "decimal.js";
import { z } from "zod";
import { isValidIsoDate } from "@/lib/domain/dates";
import { parseColombianDecimal } from "@/lib/money-input";

export const statementPaymentDateSchema = z.string().refine(isValidIsoDate, "Ingresa una fecha válida.");

const optionalMoney = (message: string) => z.string().max(100).default("").transform((value, ctx) => {
  if (!value.trim()) return null;
  try {
    const parsed = new Decimal(parseColombianDecimal(value));
    if (parsed.isNegative() || parsed.gt("999999999999.99")) throw new Error("Fuera de rango");
    return parsed;
  } catch {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  }
});

/**
 * Monthly close of a statement in one currency (F15, D39). Empty bank values and rate are removed, as before; empty
 * interest keeps the registered charge. The rate is a percentage
 * as the bank prints it, monthly (M.V.) or effective annual (E.A.).
 */
export const statementCloseSchema = z.object({
  realMinimum: optionalMoney("Ingresa el pago mínimo como aparece en tu extracto."),
  realTotal: optionalMoney("Ingresa la deuda total como aparece en tu extracto."),
  interest: optionalMoney("Ingresa los intereses como aparecen en tu extracto."),
  lateInterest: optionalMoney("Ingresa los intereses de mora como aparecen en tu extracto."),
  rate: z.string().max(20).default("").transform((value, ctx) => {
    if (!value.trim()) return null;
    try {
      const parsed = new Decimal(parseColombianDecimal(value, 4));
      if (!parsed.gt(0) || parsed.gt(1000)) throw new Error("Fuera de rango");
      return parsed.div(100);
    } catch {
      ctx.addIssue({ code: "custom", message: "Ingresa la tasa con hasta 4 decimales, por ejemplo 2,1003." });
      return z.NEVER;
    }
  }),
  rateUnit: z.enum(["mv", "ea"], { error: "Elige si la tasa es mensual o efectiva anual." }).default("mv"),
  balances: z.array(z.object({ transactionId: z.uuid("La compra no es válida."), bankBalance: optionalMoney("Ingresa el saldo como aparece en tu extracto.") })).max(500).default([]),
  reconcile: z.boolean().default(false),
});
export type StatementCloseInput = z.input<typeof statementCloseSchema>;
