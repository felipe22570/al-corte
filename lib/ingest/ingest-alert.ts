import "server-only";

import { z } from "zod";

import type { IsoDate } from "@/lib/domain/dates";
import type { Currency } from "@/lib/domain/money";
import { statementCutoffFor } from "@/lib/domain/statements";

import { readAlert } from "./bancolombia";
import { verifyAlertSignature } from "./signature";

export const MAX_BODY_BYTES = 4096;
/** Requests per minute. The script runs every hour (D43) and retries what is over the limit in its next run. */
export const REQUESTS_PER_MINUTE = 30;

const bodySchema = z.strictObject({
  message_id: z.string().trim().min(1).max(200),
  phrase: z.string().trim().min(1).max(1000),
});

export type IngestDraft = {
  user_id: string; source: "email_alert"; external_id: string; phrase: string; status: "pending" | "needs_review" | "unknown_card";
  card_id: string | null; last4: string | null; type: "purchase" | null; amount: string | null; currency: Currency | null;
  merchant_raw: string | null; occurred_on: IsoDate | null; occurred_time: string | null; statement_cutoff: IsoDate | null;
};

/** The database side of the route, so the rules and the security checks are tested without Supabase. */
export type IngestStore = {
  captureEnabled: (userId: string) => Promise<boolean>;
  withinRateLimit: (userId: string, limit: number) => Promise<boolean>;
  /** Active cards whose last 4 digits or alias match; more than one means ambiguous (D44). */
  cardsFor: (userId: string, last4: string) => Promise<Array<{ id: string; cutoffDay: number }>>;
  /** Id of the new draft, or `null` when the message already has one (dedupe by message, D46). */
  insertDraft: (draft: IngestDraft) => Promise<string | null>;
};

/** `draftId` stays on the server: the route uses it to add AI suggestions after answering (step 43). */
export type IngestResult = { status: number; body: { ok: true; result: "created" | "duplicate" | "ignored" } | { ok: false }; draftId?: string };

const failure = (status: number): IngestResult => ({ status, body: { ok: false } });

/**
 * Signed alert → draft (F18, R10). Never logs nor returns the phrase. Any unexpected failure answers 500 without
 * details, and the script retries it in its next run.
 */
export async function ingestAlert(request: { body: string; timestamp: string | null; signature: string | null }, deps: { secret: string; userId: string; store: IngestStore; now: Date }): Promise<IngestResult> {
  if (Buffer.byteLength(request.body, "utf8") > MAX_BODY_BYTES) return failure(413);
  if (!verifyAlertSignature(deps.secret, request.timestamp, request.signature, request.body, deps.now)) return failure(401);
  let json: unknown;
  try {
    json = JSON.parse(request.body);
  } catch {
    return failure(400);
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return failure(400);

  try {
    if (!await deps.store.captureEnabled(deps.userId)) return failure(403);
    if (!await deps.store.withinRateLimit(deps.userId, REQUESTS_PER_MINUTE)) return failure(429);

    const reading = readAlert(parsed.data.phrase);
    if (reading.kind === "ignored") return { status: 200, body: { ok: true, result: "ignored" } };

    const cards = reading.last4 ? await deps.store.cardsFor(deps.userId, reading.last4) : [];
    const card = cards.length === 1 ? cards[0]! : null;
    const base = { user_id: deps.userId, source: "email_alert" as const, external_id: parsed.data.message_id, phrase: parsed.data.phrase, last4: reading.last4 };
    const draft: IngestDraft = reading.kind === "purchase"
      ? {
        ...base, status: card ? "pending" : "unknown_card", card_id: card?.id ?? null, type: "purchase", amount: reading.amount, currency: reading.currency,
        merchant_raw: reading.merchant, occurred_on: reading.date, occurred_time: reading.time,
        // R1, only as a tentative data of the draft: the real statement is assigned when it is confirmed.
        statement_cutoff: card ? statementCutoffFor(card.cutoffDay, reading.date) : null,
      }
      : { ...base, status: "needs_review", card_id: card?.id ?? null, type: null, amount: null, currency: null, merchant_raw: null, occurred_on: null, occurred_time: null, statement_cutoff: null };
    const draftId = await deps.store.insertDraft(draft);
    return draftId ? { status: 200, body: { ok: true, result: "created" }, draftId } : { status: 200, body: { ok: true, result: "duplicate" } };
  } catch {
    return failure(500);
  }
}
