import Decimal from "decimal.js";
import { z } from "zod";
import { CARD_COLORS } from "@/lib/card-colors";
import { parseColombianDecimal } from "@/lib/money-input";

const money = z.string().transform((value, ctx) => {
  try {
    const parsed = parseColombianDecimal(value);
    if (new Decimal(parsed).gt("999999999999.99")) throw new Error("Fuera de rango");
    return parsed;
  } catch {
    ctx.addIssue({ code: "custom", message: "Ingresa un valor válido entre 0 y 999.999.999.999,99." });
    return z.NEVER;
  }
});
const rate = z.string().transform((value, ctx) => {
  try {
    const fraction = new Decimal(parseColombianDecimal(value, 4)).div(100);
    if (fraction.gt("999.999999")) throw new Error("Fuera de rango");
    return fraction.toFixed();
  } catch {
    ctx.addIssue({ code: "custom", message: "Ingresa una tasa válida, por ejemplo 28,5." });
    return z.NEVER;
  }
});
const day = z.coerce.number().int("Ingresa un día entero.").min(1, "El día debe estar entre 1 y 31.").max(31, "El día debe estar entre 1 y 31.");

export const cardSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre.").max(60, "Usa máximo 60 caracteres."),
  bank: z.string().trim().min(1, "Ingresa el banco.").max(60, "Usa máximo 60 caracteres."),
  network: z.enum(["Visa", "Mastercard", "American Express", "Diners", "Otra"], { error: "Elige una franquicia." }),
  last4: z.string().regex(/^\d{4}$/, "Ingresa los últimos 4 dígitos."),
  creditLimit: money, advanceFee: money, handlingFee: money,
  cutoffDay: day, paymentDay: day, purchaseRateEa: rate, advanceRateEa: rate,
  amortizationMethod: z.enum(["fixed_principal", "french"], { error: "Elige un método de amortización." }),
  color: z.enum(CARD_COLORS, { error: "Elige un color de la lista." }),
});
export type CardInput = z.input<typeof cardSchema>;
export type ValidCard = z.output<typeof cardSchema>;
