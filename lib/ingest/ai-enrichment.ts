import "server-only";

import { runTask } from "@/lib/ai/run-task";
import { extractUnknownAlertTask } from "@/lib/ai/tasks/extract-unknown-alert";
import { interpretTransactionAlertTask, type InterpretAlertOutput } from "@/lib/ai/tasks/interpret-transaction-alert";
import type { AiContext } from "@/lib/ai/types";
import type { IsoDate } from "@/lib/domain/dates";
import { relatedMerchantHistory } from "@/lib/domain/merchant-suggestions";
import type { Currency } from "@/lib/domain/money";
import { statementCutoffFor } from "@/lib/domain/statements";
import { draftSuggestionsSchema, type DraftSuggestions } from "@/lib/validation/transaction-draft";

import { verifyExtraction, type VerifiedFacts } from "./literal";

export type EnrichableDraft = {
  id: string; status: "pending" | "needs_review" | "unknown_card"; phrase: string; cardId: string | null; last4: string | null;
  type: string | null; amount: string | null; currency: Currency | null; merchantRaw: string | null; suggestions: unknown;
};
export type HistoryRow = { merchant: string; date: IsoDate; categoryId: string | null; currency: Currency; installments: number; amount: string };

/** The database side, filtered by the configured owner (service key, D51). */
export type EnrichStore = {
  loadDraft: (userId: string, draftId: string) => Promise<EnrichableDraft | null>;
  categories: (userId: string) => Promise<Array<{ id: string; name: string }>>;
  subscriptions: (userId: string, cardId: string) => Promise<Array<{ id: string; name: string; amount: string; currency: Currency; installments: number }>>;
  history: (userId: string, since: IsoDate) => Promise<HistoryRow[]>;
  cardsFor: (userId: string, last4: string) => Promise<Array<{ id: string; cutoffDay: number }>>;
  card: (userId: string, cardId: string) => Promise<{ id: string; cutoffDay: number } | null>;
  /** Only while the draft is still to review and without facts; keeps it in "Revisar" (decision of 2026-11-22). */
  saveReadFacts: (userId: string, draftId: string, facts: VerifiedFacts & { cardId: string | null; statementCutoff: IsoDate | null }) => Promise<void>;
  /** Only while the draft is open and has no suggestions yet. */
  saveSuggestions: (userId: string, draftId: string, suggestions: DraftSuggestions) => Promise<void>;
};

type Deps = { userId: string; ai: AiContext; store: EnrichStore; historySince: IsoDate };

/** AI answer → stored suggestions: ids outside the owner's lists and installments for movements without them are dropped. */
export function sanitizeSuggestions(answer: InterpretAlertOutput, context: { categoryIds: readonly string[]; subscriptionIds: readonly string[]; allowsInstallments: boolean }): DraftSuggestions | null {
  const parsed = draftSuggestionsSchema.safeParse({
    merchantName: answer.merchantName,
    categoryId: answer.categoryId && context.categoryIds.includes(answer.categoryId) ? answer.categoryId : null,
    subscriptionId: answer.subscriptionId && context.subscriptionIds.includes(answer.subscriptionId) ? answer.subscriptionId : null,
    billingCurrency: answer.billingCurrency,
    installmentsCount: context.allowsInstallments ? answer.installmentsCount : null,
    isInternational: context.allowsInstallments ? answer.isInternational : null,
    confidence: answer.confidence,
    reason: answer.reason,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * Runs after answering the script (step 43): reads unknown formats with the fallback and suggests how to classify the
 * movement. Never throws and never changes a fact read by rules; without AI the draft simply stays as it was (R10).
 */
export async function enrichDraft(draftId: string, deps: Deps): Promise<void> {
  try {
    const draft = await deps.store.loadDraft(deps.userId, draftId);
    if (!draft) return;
    let { cardId, type, amount, currency, merchantRaw } = draft;

    if (draft.status === "needs_review" && amount === null) {
      const extracted = await runTask(extractUnknownAlertTask, { phrase: draft.phrase }, deps.ai);
      const facts = extracted.ok ? verifyExtraction(draft.phrase, extracted.data) : null;
      if (!facts) return;
      // The card is still assigned by the app (D44), never by the AI.
      const last4 = draft.last4 ?? facts.last4;
      let card = cardId ? await deps.store.card(deps.userId, cardId) : null;
      if (!cardId && last4) {
        const cards = await deps.store.cardsFor(deps.userId, last4);
        card = cards.length === 1 ? cards[0]! : null;
        cardId = card?.id ?? null;
      }
      await deps.store.saveReadFacts(deps.userId, draftId, { ...facts, last4, cardId, statementCutoff: card && facts.date ? statementCutoffFor(card.cutoffDay, facts.date) : null });
      ({ type, amount, currency } = facts);
      merchantRaw = facts.merchant;
    }

    if (draft.suggestions !== null || !merchantRaw || !amount || !currency) return;
    const [categories, subscriptions, history] = await Promise.all([
      deps.store.categories(deps.userId),
      cardId ? deps.store.subscriptions(deps.userId, cardId) : Promise.resolve([]),
      deps.store.history(deps.userId, deps.historySince),
    ]);
    const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
    const answer = await runTask(interpretTransactionAlertTask, {
      merchant: merchantRaw, amount, currency, card: cardId,
      categories, subscriptions,
      history: relatedMerchantHistory(merchantRaw, history).map((row) => ({
        merchant: row.merchant, date: row.date, category: row.categoryId ? categoryNames.get(row.categoryId) ?? null : null,
        billedCurrency: row.currency, installments: row.installments, amount: row.amount,
      })),
    }, deps.ai);
    if (!answer.ok) return;
    const suggestions = sanitizeSuggestions(answer.data, {
      categoryIds: categories.map((category) => category.id), subscriptionIds: subscriptions.map((subscription) => subscription.id),
      allowsInstallments: type === null || type === "purchase" || type === "cash_advance",
    });
    if (suggestions) await deps.store.saveSuggestions(deps.userId, draftId, suggestions);
  } catch {
    // Suggestions are optional: the draft is already saved and the owner can confirm it without them.
  }
}
