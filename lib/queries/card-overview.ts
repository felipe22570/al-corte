import Decimal from "decimal.js";
import { addDays, type IsoDate } from "@/lib/domain/dates";
import { paymentMonth, statementKnownTotal, statementUsdTotal, type MonthCharge, type PaymentMonthSummary } from "@/lib/domain/months";
import type { Currency } from "@/lib/domain/money";
import { monthlyEquivalent, nextChargeDate } from "@/lib/domain/subscriptions";
import type { ServerClient } from "@/lib/supabase/require-user";
import { loadCardDetail } from "./card-detail";
import { loadMonthOverview } from "./months";
import { loadStatementDetail, type StatementConceptGroup, type StatementCurrencyBreakdown, type StatementEntry } from "./statement-detail";
import { createSupabaseMonthSource } from "./supabase-months";

/** A subscription charge expected before the cutoff and not registered yet (R7): "Previsto". */
export type ProjectedSubscriptionCharge = { subscriptionId: string; date: IsoDate; currency: Currency; amount: Decimal };

/** The open statement grouped as the card shows it, per currency; its groups add up to `total`. */
export type OpenStatementGroups = {
  currency: Currency;
  /** Purchases made in this period: single ones and the installments of purchases dated in it. */
  newPurchases: StatementEntry[];
  /** Installments of purchases made before this period. */
  installments: StatementEntry[];
  subscriptions: { charged: StatementEntry[]; projected: ProjectedSubscriptionCharge[] };
  interest: { total: Decimal; estimated: boolean };
  /** Every other concept with a value (advances and fees, handling fee, insurance, adjustments, refunds). */
  others: StatementConceptGroup[];
  /** Registered charges, the R8 estimate and the projected subscription charges (refunds subtracted). */
  total: Decimal;
};

export type StatementColumn = {
  month: string; cutoffDate: IsoDate; dueDate: IsoDate; statementId: string | null;
  /** Real statements: paid, to pay (pending or overdue) or still open; virtual ones are estimated (D65). */
  state: "paid" | "pending" | "overdue" | "open" | "estimated";
  cop: Decimal; usd: Decimal;
  /** Includes on-balance interest estimated by R8 (D66). */
  estimated: boolean;
};

/** Sum of the entries of a group in their own currency, shown next to the group title. */
export function entriesTotal(entries: StatementEntry[]) {
  return entries.reduce((sum, entry) => sum.plus(entry.amount), new Decimal(0));
}

/** Groups the open statement (Tarjeta): new purchases, earlier installments, subscriptions charged and expected, and interest. */
export function groupOpenStatement(breakdowns: StatementCurrencyBreakdown[], periodStart: IsoDate, projected: MonthCharge[]): OpenStatementGroups[] {
  const projectedSubscriptions = projected.flatMap((charge): ProjectedSubscriptionCharge[] =>
    charge.origin === "projected" && charge.concept === "subscriptions" && charge.subscriptionId && charge.date
      ? [{ subscriptionId: charge.subscriptionId, date: charge.date, currency: charge.currency ?? "COP", amount: charge.amount ?? charge.amountCop ?? new Decimal(0) }] : []);
  const currencies = [...new Set<Currency>([...breakdowns.map((item) => item.summary.currency), ...projectedSubscriptions.map((charge) => charge.currency)])];
  return currencies.map((currency) => {
    const breakdown = breakdowns.find((item) => item.summary.currency === currency);
    const concept = (key: StatementConceptGroup["key"]) => breakdown?.concepts.find((item) => item.key === key);
    const installments = concept("installments")?.entries ?? [];
    const isNew = (entry: StatementEntry) => !!entry.date && entry.date >= periodStart;
    const expected = projectedSubscriptions.filter((charge) => charge.currency === currency).sort((a, b) => a.date.localeCompare(b.date));
    const interest = concept("interest");
    const others = (breakdown?.concepts ?? []).filter((item) => ["cash_advances", "handling_fees", "insurance", "adjustments", "refunds"].includes(item.key) && !new Decimal(item.total).isZero());
    const registered = (breakdown?.concepts ?? []).reduce((sum, item) => item.key === "refunds" ? sum.minus(item.total) : sum.plus(item.total), new Decimal(0));
    return {
      currency,
      newPurchases: [...(concept("single_purchases")?.entries ?? []), ...installments.filter(isNew)].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      installments: installments.filter((entry) => !isNew(entry)),
      subscriptions: { charged: concept("subscriptions")?.entries ?? [], projected: expected },
      interest: { total: new Decimal(interest?.total ?? 0), estimated: interest?.estimated ?? false },
      others,
      total: registered.plus(expected.reduce((sum, charge) => sum.plus(charge.amount), new Decimal(0))),
    };
  });
}

/** Statements of a card by payment month (R7), with their state (D65) and amounts per currency (D33). */
export function cardStatementColumns(months: PaymentMonthSummary[], cardId: string, today: IsoDate): StatementColumn[] {
  return months.flatMap((month) => month.cards.filter((group) => group.cardId === cardId).flatMap((group) => group.statements.map(({ statement, status }): StatementColumn => ({
    month: paymentMonth(statement.dueDate), cutoffDate: statement.cutoffDate, dueDate: statement.dueDate, statementId: statement.id ?? null,
    state: status === "virtual" ? "estimated" : status === "paid" ? "paid" : statement.cutoffDate >= today ? "open" : status,
    cop: statementKnownTotal(statement), usd: statementUsdTotal(statement),
    estimated: statement.charges?.some((charge) => charge.estimated) ?? false,
  })))).sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate));
}

export type CardOverview = NonNullable<Awaited<ReturnType<typeof loadCardOverview>>>;

/**
 * Tarjeta of the new interface: the card detail plus its open statement grouped, its subscriptions with the next charge and
 * monthly cost per currency, its statements by payment month and its installments still to pay. Null when it does not exist.
 */
export async function loadCardOverview(supabase: ServerClient, userId: string, cardId: string, today: IsoDate) {
  const detail = await loadCardDetail(supabase, userId, cardId, today);
  if (!detail) return null;
  const source = createSupabaseMonthSource(supabase, userId);
  const [openStatement, overview, subscriptions] = await Promise.all([
    loadStatementDetail(supabase, userId, cardId, detail.openCutoff, today),
    loadMonthOverview(source, today),
    source.loadSubscriptions(),
  ]);
  if (!openStatement) throw new Error("No pudimos consultar el extracto abierto.");
  const months = [...overview.history, overview.current, ...overview.future];
  const statements = months.flatMap((month) => month.statements).filter((statement) => statement.cardId === cardId);
  const open = statements.find((statement) => statement.cutoffDate === detail.openCutoff);
  // A charge registered today already happened: the next one comes after it, as in Suscripciones.
  const chargedToday = new Set(statements.flatMap((statement) => statement.charges ?? []).flatMap((charge) => charge.origin === "real" && charge.date === today && charge.subscriptionId ? [charge.subscriptionId] : []));
  const cardSubscriptions = subscriptions.filter((subscription) => subscription.cardId === cardId && subscription.status !== "cancelled").map((subscription) => ({
    subscription,
    nextCharge: nextChargeDate(subscription, chargedToday.has(subscription.id) ? addDays(today, 1) : today),
  }));
  const monthlyCost = { COP: new Decimal(0), USD: new Decimal(0) };
  for (const { subscription } of cardSubscriptions) {
    if (subscription.status === "active") monthlyCost[subscription.currency] = monthlyCost[subscription.currency].plus(monthlyEquivalent(subscription.amount, subscription.frequency));
  }
  const pendingPrincipal = { COP: new Decimal(0), USD: new Decimal(0) };
  for (const { purchase, progress } of detail.activePurchases) pendingPrincipal[purchase.currency] = pendingPrincipal[purchase.currency].plus(progress.pendingPrincipal);
  return {
    ...detail,
    openStatement: {
      periodStart: openStatement.period.periodStart, cutoffDate: openStatement.period.cutoffDate, dueDate: openStatement.period.dueDate,
      groups: groupOpenStatement(openStatement.breakdowns, openStatement.period.periodStart, open?.charges ?? []),
    },
    subscriptions: cardSubscriptions,
    monthlyCost,
    pendingPrincipal,
    statementColumns: cardStatementColumns(months, cardId, today),
    hasLaterCommitments: overview.hasLaterCommitments,
  };
}
