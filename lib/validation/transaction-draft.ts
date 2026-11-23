import { z } from "zod";

/**
 * AI suggestions stored in a captured draft (F18, R10). They interpret the alert; they never carry amount, currency of
 * the charge, date or card. Step 43 fills them; here they are validated when saved and again when read.
 */
export const draftSuggestionsSchema = z.strictObject({
  merchantName: z.string().trim().min(1).max(100).nullable().default(null),
  categoryId: z.uuid().nullable().default(null),
  subscriptionId: z.uuid().nullable().default(null),
  /** Probable billing currency: a Google charge alerted in pesos may be billed in dollars. A hint, never applied. */
  billingCurrency: z.enum(["COP", "USD"]).nullable().default(null),
  installmentsCount: z.int().min(1).max(36).nullable().default(null),
  isInternational: z.boolean().nullable().default(null),
  confidence: z.enum(["alta", "media", "baja"]),
  reason: z.string().trim().min(1).max(200).nullable().default(null),
});
export type DraftSuggestions = z.output<typeof draftSuggestionsSchema>;

/** Stored suggestions that no longer validate are ignored: the draft is shown without them. */
export function parseDraftSuggestions(value: unknown): DraftSuggestions | null {
  if (value === null || value === undefined) return null;
  const parsed = draftSuggestionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const draftStatusSchema = z.enum(["pending", "needs_review", "unknown_card"]);
export type OpenDraftStatus = z.output<typeof draftStatusSchema>;
