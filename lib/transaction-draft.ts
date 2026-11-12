import { z } from "zod";
import { storageKey } from "@/lib/brand";
import { transactionSchema, type TransactionInput } from "@/lib/validation/transaction";

const draftSchema = z.strictObject({
  version: z.literal(1),
  baseline: z.string().max(6000),
  savedAt: z.number().finite(),
  values: z.strictObject({
    cardId: z.string().max(36),
    type: transactionSchema.shape.type,
    date: z.string().max(10),
    amount: z.string().max(100),
    currency: transactionSchema.shape.currency,
    fxRate: z.string().max(100),
    installmentsCount: z.union([z.string().max(10), z.number().finite()]),
    interestFree: z.boolean(),
    categoryId: z.string().max(36),
    merchant: z.string().max(200),
    note: z.string().max(1000),
  }),
});

export function transactionDraftKey(userId: string, transactionId?: string) {
  return storageKey(`transaction-draft:${userId}:${transactionId ?? "new"}`);
}

export function encodeTransactionDraft(values: TransactionInput, baseline: string, now = Date.now()) {
  return JSON.stringify(draftSchema.parse({ version: 1, baseline, savedAt: now, values }));
}

export function decodeTransactionDraft(raw: string | null, baseline: string, now = Date.now()): TransactionInput | null {
  if (!raw || raw.length > 20000) return null;
  try {
    const draft = draftSchema.parse(JSON.parse(raw));
    if (draft.baseline !== baseline || now < draft.savedAt || now - draft.savedAt > 86400000) return null;
    return draft.values;
  } catch {
    return null;
  }
}
