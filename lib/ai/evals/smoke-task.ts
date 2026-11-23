import "server-only";

import { z } from "zod";

import type { AiTask } from "../types";

const input = z.object({ phrase: z.string().min(1).max(300) });
const output = z.object({
  merchant: z.string().min(1).max(100).describe("Comercio tal como aparece en la frase"),
  amount: z.string().regex(/^\d+\.\d{2}$/).describe("Valor con punto decimal y dos decimales, sin separadores de miles"),
  currency: z.enum(["COP", "USD"]),
});

/**
 * Minimal task with fictitious phrases only, to check the API key, the configured model and structured outputs end
 * to end (step 40). It is not used by the app; the real tasks arrive in step 43.
 */
export const smokeCheckTask: AiTask<typeof input, typeof output> = {
  name: "smokeCheck",
  promptVersion: "v1",
  maxTokens: 1000,
  effort: "low",
  input,
  output,
  system: [
    "Recibes una frase de una compra con tarjeta.",
    "Extrae el comercio tal como aparece, el valor y la moneda (COP o USD).",
    "El valor va con punto decimal y dos decimales, sin separadores de miles: \"COP 1.234,50\" es \"1234.50\".",
  ].join("\n"),
  data: (value) => value.phrase,
};
