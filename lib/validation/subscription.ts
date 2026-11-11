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
    ctx.addIssue({ code: "custom", message: "Ingresa un valor válido mayor que cero." });
    return z.NEVER;
  }
});
const optionalDate = z.union([z.literal(""), z.string().refine(isValidIsoDate, "Ingresa una fecha válida.")]).transform((value) => value || null);
export const subscriptionSchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre.").max(100, "Usa máximo 100 caracteres."),
  cardId: z.uuid("Elige una tarjeta válida."),
  categoryId: z.union([z.uuid("Elige una categoría válida."), z.literal("")]).transform((value) => value || null),
  amount,
  currency: z.enum(["COP", "USD"]),
  frequency: z.enum(["monthly", "yearly"]),
  billingDay: z.coerce.number().int().min(1, "Elige un día entre 1 y 31.").max(31, "Elige un día entre 1 y 31."),
  startDate: z.string().refine(isValidIsoDate, "Ingresa una fecha válida."),
  trialEndsAt: optionalDate,
});
export type SubscriptionInput = z.input<typeof subscriptionSchema>;
export type ValidSubscription = z.output<typeof subscriptionSchema>;
