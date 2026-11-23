import "server-only";

import { z } from "zod";

import type { AiTask } from "../types";

const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/);
const currency = z.enum(["COP", "USD"]);

const input = z.object({
  merchant: z.string().trim().min(1).max(200),
  amount: money,
  currency,
  /** Internal identifier, never the card number (R10). */
  card: z.string().trim().min(1).max(40).nullable(),
  categories: z.array(z.object({ id: z.uuid(), name: z.string().max(100) })).max(100),
  subscriptions: z.array(z.object({ id: z.uuid(), name: z.string().max(200), amount: money, currency, installments: z.int().min(1).max(36) })).max(50),
  history: z.array(z.object({
    merchant: z.string().max(200), date: z.iso.date(), category: z.string().max(100).nullable(), billedCurrency: currency, installments: z.int().min(1).max(72), amount: money,
  })).max(10),
});

/**
 * No field for amount, currency of the charge, date or card: the AI cannot define them (R10). `strictObject` makes any
 * extra field an invalid answer. Category and subscription ids are checked against the owner's lists afterwards.
 */
const output = z.strictObject({
  merchantName: z.string().trim().min(1).max(100).nullable().describe("Nombre limpio y legible del comercio, o null si el que llegó ya está bien"),
  categoryId: z.string().max(40).nullable().describe("id de una de las categorías recibidas, o null"),
  subscriptionId: z.string().max(40).nullable().describe("id de una suscripción recibida que corresponde a este cobro, o null"),
  billingCurrency: currency.nullable().describe("Moneda en que el banco probablemente factura este cobro, o null sin evidencia"),
  installmentsCount: z.int().min(1).max(36).nullable().describe("Cuotas sugeridas según el historial, o null"),
  isInternational: z.boolean().nullable(),
  confidence: z.enum(["alta", "media", "baja"]),
  reason: z.string().trim().min(1).max(200).nullable().describe("Razón corta en español, sin datos personales"),
});

export type InterpretAlertInput = z.input<typeof input>;
export type InterpretAlertOutput = z.output<typeof output>;

/** Suggestions for a captured purchase (F18, R10): interprets, never decides a fact of the movement. */
export const interpretTransactionAlertTask: AiTask<typeof input, typeof output> = {
  name: "interpretTransactionAlert",
  promptVersion: "v1",
  maxTokens: 2000,
  effort: "low",
  input,
  output,
  system: [
    "Ayudas a una persona en Colombia a clasificar las compras con su tarjeta de crédito que llegan por alertas del banco.",
    "Recibes en JSON: el comercio tal como lo escribió el banco, el valor y la moneda de la alerta, un identificador interno de la tarjeta,",
    "las categorías de la persona, las suscripciones activas de esa tarjeta y las compras anteriores de ese comercio o de comercios con el mismo prefijo antes del asterisco.",
    "Sugiere:",
    "- merchantName: un nombre limpio y corto (\"GOOGLE *ChatGPT\" → \"Google ChatGPT\"). null si el original ya se lee bien.",
    "- categoryId: solo un id de la lista de categorías. Prefiere la categoría que usó la persona en el historial. null si no hay una clara.",
    "- subscriptionId: solo un id de la lista de suscripciones, cuando el comercio corresponde claramente a esa suscripción aunque el valor haya cambiado. null si no.",
    "- billingCurrency: la moneda en que el banco factura este cobro según el historial del comercio o del prefijo (por ejemplo, cobros de Google facturados en USD). null si no hay evidencia.",
    "- installmentsCount: las cuotas que usó la persona en el historial de ese comercio o prefijo. null si no hay historial.",
    "- isInternational: true si el historial o el comercio indican un cobro del exterior; null si no sabes.",
    "- confidence: alta si el historial lo respalda directamente, media si es una inferencia razonable, baja si es una suposición.",
    "- reason: una frase corta en español que explique la sugerencia.",
    "Nunca inventes ids. No cambies el valor, la moneda de la alerta, la fecha ni la tarjeta: no son parte de tu respuesta.",
  ].join("\n"),
  data: (value) => JSON.stringify(value),
};
