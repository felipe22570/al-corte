import type { IsoDate } from "@/lib/domain/dates";
import { draftFormStart, type CapturedFormStart } from "@/lib/draft-form";
import { formatAmountInput } from "@/lib/money-input";
import type { ServerClient } from "@/lib/supabase/require-user";
import type { TransactionCardOption, TransactionCategoryOption } from "@/lib/transaction-options";
import { transactionTypeSchema, type TransactionInput } from "@/lib/validation/transaction";
import { loadOpenDraft, type InboxDraft } from "./drafts";
import { loadMerchantHistory } from "./merchant-history";
import { loadRecentStatementCutoffs } from "./statement-cutoffs";

type RawCard = { id: string; name: string; last4: string; color: TransactionCardOption["color"]; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: TransactionCardOption["amortizationMethod"]; interest_mode: "per_installment" | "on_balance"; usd_default_installments: number };
type RawTransaction = { card_id: string; category_id: string | null; type: string; date: IsoDate; amount: string; currency: "COP" | "USD"; fx_rate: string | null; installments_count: number; interest_free: boolean; merchant: string | null; note: string | null; rate_ea_applied: string | null; parent_id: string | null; statement_id: string; prior_installments: number; original_installments_count: number | null; is_international: boolean; paid_statement_id: string | null };
type RawInstallment = { statement_id: string | null; number: number; balance_after: string };

const draftIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function transactionCardOption(card: RawCard): TransactionCardOption {
  return { id: card.id, name: card.name, last4: card.last4, color: card.color, cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea, advanceRateEa: card.advance_rate_ea, advanceFee: card.advance_fee, amortizationMethod: card.amortization_method, interestMode: card.interest_mode, usdDefaultInstallments: card.usd_default_installments };
}

function activeCardsQuery(supabase: ServerClient, userId: string) {
  return supabase.from("cards").select("id,name,last4,color,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method,interest_mode,usd_default_installments").eq("user_id", userId).is("archived_at", null).order("name");
}

function activeCategoriesQuery(supabase: ServerClient, userId: string) {
  return supabase.from("categories").select("id,name,icon").eq("user_id", userId).is("archived_at", null).order("name");
}

/**
 * D4: the latest TRM in `fx_rates`; without one, the TRM of the latest dollar movement of the owner. Null when there is none.
 */
export async function loadLatestFxRate(supabase: ServerClient, userId: string): Promise<string | null> {
  const rate = await supabase.from("fx_rates").select("usd_cop::text").order("date", { ascending: false }).limit(1).maybeSingle();
  if (rate.error) throw new Error("No pudimos consultar la última TRM.");
  const latest = (rate.data as { usd_cop: string } | null)?.usd_cop ?? null;
  if (latest) return latest;
  const previous = await supabase.from("transactions").select("fx_rate::text").eq("user_id", userId).eq("currency", "USD").not("fx_rate", "is", null).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (previous.error) throw new Error("No pudimos consultar la última TRM.");
  return (previous.data as { fx_rate: string } | null)?.fx_rate ?? null;
}

export type CapturedDraftStart = CapturedFormStart & { id: string; phrase: string; last4: string | null; readByAi: boolean; billingCurrency: "COP" | "USD" | null; unknownCard: boolean };

/** A captured draft prefilled for the form (F18), keeping the alert's amount and currency (R10). */
export function capturedDraftStart(draft: InboxDraft, cards: TransactionCardOption[], categories: TransactionCategoryOption[], today: IsoDate, latestRate: string | null): CapturedDraftStart {
  return {
    id: draft.id,
    phrase: draft.phrase,
    last4: draft.last4,
    readByAi: draft.readByAi,
    billingCurrency: draft.suggestions?.billingCurrency && draft.suggestions.billingCurrency !== draft.currency ? draft.suggestions.billingCurrency : null,
    unknownCard: draft.status === "unknown_card" || !cards.some((card) => card.id === draft.cardId),
    ...draftFormStart({ cardId: draft.cardId, type: draft.type, amount: draft.amount, currency: draft.currency, merchantRaw: draft.merchantRaw, occurredOn: draft.occurredOn, suggestions: draft.suggestions },
      { cardIds: cards.map((card) => card.id), categoryIds: categories.map((category) => category.id), today, latestRate }),
  };
}

export type NewTransactionForm = NonNullable<Awaited<ReturnType<typeof loadNewTransactionForm>>>;

/**
 * The quick entry form (F2): active cards and categories, TRM (D4), cutoffs for in-progress purchases (D49) and merchant
 * history (D53). With `draftId`, the captured draft it confirms (F18); null when that draft is no longer open.
 */
export async function loadNewTransactionForm(supabase: ServerClient, userId: string, today: IsoDate, draftId?: string) {
  const draft = draftId && draftIdPattern.test(draftId) ? await loadOpenDraft(supabase, userId, draftId) : null;
  if (draftId && !draft) return null;
  const [cardsResult, categoriesResult, latestRate, existingCutoffs, merchantHistory] = await Promise.all([
    activeCardsQuery(supabase, userId),
    activeCategoriesQuery(supabase, userId),
    loadLatestFxRate(supabase, userId),
    loadRecentStatementCutoffs(supabase, userId, today),
    loadMerchantHistory(supabase, userId, today),
  ]);
  if (cardsResult.error || categoriesResult.error) throw new Error("No pudimos cargar los datos del movimiento.");
  const cards = ((cardsResult.data ?? []) as RawCard[]).map(transactionCardOption);
  const categories = (categoriesResult.data ?? []) as TransactionCategoryOption[];
  return { cards, categories, latestRate, existingCutoffs, merchantHistory, captured: draft ? capturedDraftStart(draft, cards, categories, today, latestRate) : undefined };
}

export type TransactionEditForm = NonNullable<Awaited<ReturnType<typeof loadTransactionEditForm>>>;

/**
 * Editing a movement (F2): the full form, or only category, merchant and note when it has prepayments or covers a statement
 * (R9). Null when the movement does not exist or cannot be edited (an advance fee follows its advance).
 */
export async function loadTransactionEditForm(supabase: ServerClient, userId: string, id: string, today: IsoDate) {
  const [transactionResult, cardsResult, categoriesResult, installmentsResult, prepaymentsResult, feeResult] = await Promise.all([
    supabase.from("transactions").select("card_id,category_id,type,date,amount::text,currency,fx_rate::text,installments_count,interest_free,merchant,note,rate_ea_applied::text,parent_id,statement_id,prior_installments,original_installments_count,is_international,paid_statement_id").eq("id", id).eq("user_id", userId).maybeSingle(),
    activeCardsQuery(supabase, userId),
    activeCategoriesQuery(supabase, userId),
    supabase.from("installments").select("statement_id,number,balance_after::text").eq("transaction_id", id).eq("user_id", userId),
    supabase.from("principal_prepayments").select("id", { count: "exact", head: true }).eq("user_id", userId).or(`transaction_id.eq.${id},payment_id.eq.${id}`),
    // D41: an advance keeps its own fee when edited.
    supabase.from("transactions").select("amount::text").eq("user_id", userId).eq("parent_id", id).eq("type", "advance_fee").maybeSingle(),
  ]);
  if (transactionResult.error || cardsResult.error || categoriesResult.error || installmentsResult.error || prepaymentsResult.error || feeResult.error) throw new Error("No pudimos cargar el movimiento.");
  if (!transactionResult.data) return null;
  const transaction = transactionResult.data as unknown as RawTransaction;
  const type = transactionTypeSchema.safeParse(transaction.type);
  if (!type.success || (transaction.type === "advance_fee" && transaction.parent_id)) return null;
  const installments = (installmentsResult.data ?? []) as unknown as RawInstallment[];
  const statementIds = installments.flatMap((row) => row.statement_id ? [row.statement_id] : []);
  const [paid, statementResult, existingCutoffs] = await Promise.all([
    statementIds.length ? supabase.from("statement_balances").select("id", { count: "exact", head: true }).eq("user_id", userId).in("statement_id", statementIds).not("paid_at", "is", null) : Promise.resolve({ count: 0, error: null }),
    supabase.from("statements").select("cutoff_date").eq("id", transaction.statement_id).eq("user_id", userId).single(),
    loadRecentStatementCutoffs(supabase, userId, today),
  ]);
  if (paid.error || statementResult.error) throw new Error("No pudimos consultar los extractos del movimiento.");
  const cards = ((cardsResult.data ?? []) as RawCard[]).map(transactionCardOption);
  const categories = (categoriesResult.data ?? []) as TransactionCategoryOption[];
  const categoryArchived = !!transaction.category_id && !categories.some((category) => category.id === transaction.category_id);
  if (categoryArchived) {
    const archived = await supabase.from("categories").select("id,name,icon").eq("id", transaction.category_id!).eq("user_id", userId).maybeSingle();
    if (archived.error || !archived.data) throw new Error("No pudimos consultar la categoría del movimiento.");
    categories.push({ ...archived.data, name: `${archived.data.name} (archivada)` });
  }
  const cardArchived = !cards.some((card) => card.id === transaction.card_id);
  const details = { categoryId: transaction.category_id ?? "", merchant: transaction.merchant ?? "", note: transaction.note ?? "" };
  // R9: regenerating the plan or the payment would undo its prepayments; only descriptive fields change.
  if ((prepaymentsResult.count ?? 0) > 0 || transaction.paid_statement_id) {
    return { mode: "details" as const, type: type.data, categories, details };
  }
  // An in-progress purchase is edited with the data copied from the bank (D49): k, the bank balance when it changed the plan, and the statement of k.
  const prior = transaction.prior_installments;
  const installmentK = installments.find((row) => row.number === prior + 1);
  const inProgress = prior > 0 ? {
    inProgress: true, currentInstallment: String(prior + 1), trackedFromCutoff: (statementResult.data as { cutoff_date: IsoDate }).cutoff_date,
    balanceAfter: transaction.original_installments_count !== null && installmentK ? installmentK.balance_after.replace(".", ",") : "",
  } : {};
  const initial: TransactionInput = {
    cardId: cardArchived ? "" : transaction.card_id, type: type.data, date: transaction.date, amount: transaction.amount.replace(".", ","), currency: transaction.currency, fxRate: transaction.fx_rate?.replace(".", ",") ?? "",
    installmentsCount: String(transaction.original_installments_count ?? transaction.installments_count), interestFree: transaction.interest_free, isInternational: transaction.is_international,
    advanceFee: transaction.type === "cash_advance" && prior === 0 ? formatAmountInput((feeResult.data as { amount: string } | null)?.amount ?? "0") : "", ...details, ...inProgress,
  };
  return {
    mode: "full" as const, type: type.data, cards, categories, existingCutoffs, latestRate: transaction.fx_rate, cardArchived, categoryArchived,
    original: { cardId: transaction.card_id, type: type.data, rateEaApplied: transaction.rate_ea_applied },
    hasPaidInstallments: (paid.count ?? 0) > 0, initial,
  };
}
