import "server-only";

import { z } from "zod";

import type { AiTask } from "../types";

const input = z.object({ phrase: z.string().trim().min(1).max(1000) });

/** Everything as text copied from the alert, so the app can verify it literally before trusting it (R10). */
const output = z.strictObject({
  type: z.enum(["purchase", "cash_advance", "payment", "refund", "other"]).describe("purchase compra, cash_advance avance o retiro, payment pago a la tarjeta, refund devolución, other cualquier otra cosa"),
  amountText: z.string().max(30).nullable().describe("El valor copiado exactamente como aparece, sin símbolo de moneda: \"1.178.836,00\""),
  currency: z.enum(["COP", "USD"]).nullable().describe("USD solo si el texto dice USD o US$; COP si es en pesos"),
  merchant: z.string().max(200).nullable().describe("Comercio copiado exactamente como aparece, o null"),
  dateText: z.string().max(10).nullable().describe("Fecha copiada exactamente en formato dd/mm/aaaa, o null"),
  timeText: z.string().max(5).nullable().describe("Hora copiada exactamente en formato hh:mm, o null"),
  last4: z.string().max(4).nullable().describe("Los 4 dígitos después de T.Cred *, o null"),
});

export type ExtractAlertOutput = z.output<typeof output>;

/** Fallback for credit card alerts the rules do not recognize (R10). The app verifies every number afterwards. */
export const extractUnknownAlertTask: AiTask<typeof input, typeof output> = {
  name: "extractUnknownAlert",
  promptVersion: "v1",
  maxTokens: 1500,
  effort: "low",
  input,
  output,
  system: [
    "Lees una alerta de Bancolombia sobre una tarjeta de crédito cuyo formato no es el de una compra conocida.",
    "Copia del texto, sin cambiar ni un carácter, el valor, el comercio, la fecha, la hora y los 4 dígitos de la tarjeta.",
    "No calcules, no conviertas ni completes valores: si un dato no está en el texto, responde null.",
    "Clasifica el tipo según lo que pasó con la tarjeta de crédito:",
    "- purchase: un comercio le cobró a la tarjeta (compraste, te cobraron, pago en un comercio, suscripción).",
    "- cash_advance: retiro de efectivo o avance.",
    "- payment: un pago hecho a la tarjeta, por ejemplo desde una cuenta de ahorros.",
    "- refund: devolución, reverso o abono de un comercio.",
    "- other: cualquier otra cosa (cambios de cupo, extractos, avisos).",
  ].join("\n"),
  data: (value) => value.phrase,
};
