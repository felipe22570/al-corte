import Decimal from "decimal.js";
import { daysBetween, type IsoDate } from "@/lib/domain/dates";
import { currencyPaidAt, paymentMonth, statementKnownTotal, statementUsdTotal, type MonthStatement, type PaymentMonthSummary } from "@/lib/domain/months";
import type { Currency } from "@/lib/domain/money";
import type { ServerClient } from "@/lib/supabase/require-user";
import { loadOpenDrafts, type InboxDraft } from "./drafts";
import { loadMonthOverview } from "./months";
import { createSupabaseMonthSource, type MonthCardDetails } from "./supabase-months";

/** Days before the due date when a payment needs attention (`AGENTS.md`: 5 days or fewer). */
export const DUE_SOON_DAYS = 5;

/** What is left to pay of a statement, per currency (D33): the calculated minimum of each currency not marked paid (D26). */
export type PayableStatement = {
  statementId: string; cardId: string; cutoffDate: IsoDate; dueDate: IsoDate; month: string;
  cop: Decimal; usd: Decimal;
  /** The minimum includes on-balance interest estimated by R8 (D66 "Estimado"). */
  estimated: boolean;
};

export type AttentionItem =
  | { kind: "overdue"; statement: PayableStatement }
  | { kind: "due_soon"; statement: PayableStatement; days: number }
  | { kind: "drafts"; count: number }
  | { kind: "reconcile"; cardId: string; cutoffDate: IsoDate; dueDate: IsoDate }
  | { kind: "price_change"; draftId: string; name: string; charged: Decimal; expected: Decimal; currency: Currency };

function monthStatements(months: PaymentMonthSummary[]): MonthStatement[] {
  return months.flatMap((month) => month.statements);
}

/** Real statements already cut and not paid in every currency with charges (R7, D26). */
export function payableStatements(months: PaymentMonthSummary[], today: IsoDate): PayableStatement[] {
  return monthStatements(months).flatMap((statement) => {
    if (statement.origin !== "real" || !statement.id || statement.paidAt || statement.cutoffDate >= today) return [];
    return [{
      statementId: statement.id, cardId: statement.cardId, cutoffDate: statement.cutoffDate, dueDate: statement.dueDate, month: paymentMonth(statement.dueDate),
      cop: currencyPaidAt(statement, "COP") ? new Decimal(0) : statementKnownTotal(statement),
      usd: currencyPaidAt(statement, "USD") ? new Decimal(0) : statementUsdTotal(statement),
      estimated: statement.charges?.some((charge) => charge.estimated) ?? false,
    }];
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.cardId.localeCompare(b.cardId));
}

/**
 * The next payment (Inicio): the nearest payment month with cut statements still to pay and due today or later, with its
 * statements per card. Overdue statements are not part of it; they lead "Para atender". Null when nothing is due.
 */
export function nextPayment(months: PaymentMonthSummary[], today: IsoDate) {
  const upcoming = payableStatements(months, today).filter((statement) => statement.dueDate >= today);
  const first = upcoming[0];
  if (!first) return null;
  const statements = upcoming.filter((statement) => statement.month === first.month);
  return {
    month: first.month,
    dueDate: first.dueDate,
    days: daysBetween(today, first.dueDate),
    cop: statements.reduce((sum, statement) => sum.plus(statement.cop), new Decimal(0)),
    usd: statements.reduce((sum, statement) => sum.plus(statement.usd), new Decimal(0)),
    estimated: statements.some((statement) => statement.estimated),
    statements,
  };
}

/**
 * "Cupo usado" (D66): pesos used and net dollars of every card, archived ones with a balance included, each in its currency
 * (D52). It is not the sum of the statements' total debt.
 */
export function creditUsed(cards: MonthCardDetails[]) {
  return {
    cop: cards.reduce((sum, card) => sum.plus(card.copUsed ?? 0), new Decimal(0)),
    usd: cards.reduce((sum, card) => sum.plus(card.usdNet ?? 0), new Decimal(0)),
    /** Some dollar debt was valued with the TRM of each purchase because there is no TRM in force (D52). */
    fxEstimated: cards.some((card) => card.fxEstimated && !(card.usdNet ?? new Decimal(0)).isZero()),
  };
}

/**
 * "Para atender" (Inicio): overdue statements first, then payments due in 5 days or fewer, open drafts, statements to close
 * against the bank (F15) and subscription price changes, which are only known through a captured draft.
 */
export function attentionItems(input: { months: PaymentMonthSummary[]; drafts: InboxDraft[]; toReview: Array<{ cardId: string; cutoffDate: IsoDate; dueDate: IsoDate }>; today: IsoDate }): AttentionItem[] {
  const payable = payableStatements(input.months, input.today);
  const items: AttentionItem[] = [
    ...payable.filter((statement) => statement.dueDate < input.today).map((statement): AttentionItem => ({ kind: "overdue", statement })),
    ...payable.flatMap((statement): AttentionItem[] => {
      const days = daysBetween(input.today, statement.dueDate);
      return days >= 0 && days <= DUE_SOON_DAYS ? [{ kind: "due_soon", statement, days }] : [];
    }),
  ];
  if (input.drafts.length) items.push({ kind: "drafts", count: input.drafts.length });
  items.push(...input.toReview.map((review): AttentionItem => ({ kind: "reconcile", ...review })));
  for (const draft of input.drafts) {
    const change = draft.subscription?.change;
    if (draft.subscription && change) items.push({ kind: "price_change", draftId: draft.id, name: draft.subscription.name, charged: new Decimal(change.charged), expected: new Decimal(change.expected), currency: change.currency });
  }
  return items;
}

export type Home = Awaited<ReturnType<typeof loadHome>>;

/** Inicio of the new interface: payment months (R7), cards with their credit, next payment, "Cupo usado" and "Para atender". */
export async function loadHome(supabase: ServerClient, userId: string, today: IsoDate) {
  const source = createSupabaseMonthSource(supabase, userId);
  const [overview, cards, drafts] = await Promise.all([
    loadMonthOverview(source, today),
    source.loadCardDetails(),
    loadOpenDrafts(supabase, userId),
  ]);
  const months = [...overview.history, overview.current, ...overview.future];
  return {
    overview, cards,
    activeCards: cards.filter((card) => !card.archived),
    draftCount: drafts.length,
    nextPayment: nextPayment(months, today),
    creditUsed: creditUsed(cards),
    attention: attentionItems({ months, drafts, toReview: overview.toReview, today }),
  };
}
