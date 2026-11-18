import Decimal from "decimal.js";
import { z } from "zod";
import { isValidIsoDate } from "@/lib/domain/dates";
import { parseColombianDecimal } from "@/lib/money-input";

export const realTotalSchema = z.string().transform((value, ctx) => {
  if (!value.trim()) return null;
  try {
    const parsed = parseColombianDecimal(value);
    if (new Decimal(parsed).gt("999999999999.99")) throw new Error("Fuera de rango");
    return parsed;
  } catch {
    ctx.addIssue({ code: "custom", message: "Ingresa un valor válido." });
    return z.NEVER;
  }
});

/** Minimum payment and total debt copied from the bank statement, per currency (D33). Empty removes the value. */
export const bankValuesSchema = z.object({ realMinimum: realTotalSchema, realTotal: realTotalSchema });

export const statementPaymentDateSchema = z.string().refine(isValidIsoDate, "Ingresa una fecha válida.");

const positiveMoney = (places: number, message: string) => z.string().transform((value, ctx) => {
  try {
    const parsed = new Decimal(parseColombianDecimal(value, places));
    if (!parsed.gt(0) || parsed.gt(places === 2 ? "999999999999.99" : "99999999.9999")) throw new Error("Fuera de rango");
    return parsed.toFixed();
  } catch {
    ctx.addIssue({ code: "custom", message });
    return z.NEVER;
  }
});

/** Real interest copied from the bank statement (F11): it replaces the R8 estimate. */
export const statementInterestSchema = z.object({
  amount: positiveMoney(2, "Ingresa los intereses como aparecen en tu extracto."),
  currency: z.enum(["COP", "USD"], { error: "Elige una moneda." }),
  fxRate: z.string().default(""),
}).transform((value, ctx) => {
  if (value.currency === "COP") return { amount: value.amount, currency: value.currency, fxRate: null };
  const fxRate = positiveMoney(4, "Ingresa la TRM para intereses en dólares.").safeParse(value.fxRate);
  if (!fxRate.success) {
    ctx.addIssue({ code: "custom", path: ["fxRate"], message: "Ingresa la TRM para intereses en dólares." });
    return z.NEVER;
  }
  return { amount: value.amount, currency: value.currency, fxRate: fxRate.data };
});
