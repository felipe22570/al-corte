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

export const statementPaymentDateSchema = z.string().refine(isValidIsoDate, "Ingresa una fecha válida.");
