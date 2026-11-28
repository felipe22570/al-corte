import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import { statementKnownTotal, statementUsdTotal, type MonthStatement, type PaymentMonthSummary } from "@/lib/domain/months";
import type { Currency } from "@/lib/domain/money";
import { statementPeriod } from "@/lib/domain/statements";
import { fetchAllPages } from "@/lib/paginate";
import type { ServerClient } from "@/lib/supabase/require-user";
import { activeInstallmentPurchases, type ActivePurchase, type CardStatement } from "./card-detail";
import { payableStatements, type PayableStatement } from "./home";
import { loadMonthOverview } from "./months";
import { createSupabaseMonthSource, type MonthCardDetails } from "./supabase-months";

type RawPurchase = { id: string; card_id: string; merchant: string | null; currency: Currency; installments_count: number };
type RawInstallment = { transaction_id: string; statement_id: string | null; before_tracking: boolean; number: number; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };

/** Amounts of a statement in each currency (D33), with the R8 estimate flag (D66). */
export type StatementFigures = { cutoffDate: IsoDate; dueDate: IsoDate; cop: Decimal; usd: Decimal; estimated: boolean };

export type CardListEntry = {
  card: MonthCardDetails;
  /** Earliest cut statement still to pay (R7, D26), overdue ones included. */
  nextPayment: PayableStatement | null;
  /** Total debt per currency at the latest cutoff (R8, D66). */
  debt: StatementFigures | null;
  /** The statement that is open today, saved or projected; zero when nothing is registered or expected yet. */
  open: StatementFigures;
  installmentsInProgress: ActivePurchase[];
  /** Principal still to pay of those purchases, per currency. */
  pendingPrincipal: Record<Currency, Decimal>;
  /** Active and paused subscriptions of the card. */
  subscriptions: number;
};

function estimated(statement: MonthStatement) {
  return statement.charges?.some((charge) => charge.estimated) ?? false;
}

/** Statements grouped by card, by cutoff date. */
function statementsByCard(months: PaymentMonthSummary[]) {
  const result = new Map<string, MonthStatement[]>();
  for (const statement of months.flatMap((month) => month.statements)) result.set(statement.cardId, [...result.get(statement.cardId) ?? [], statement]);
  for (const list of result.values()) list.sort((a, b) => a.cutoffDate.localeCompare(b.cutoffDate));
  return result;
}

/** The four figures of each card (Tarjetas): next payment, credit, total debt and open statement. */
export function cardListEntries(input: {
  cards: MonthCardDetails[]; months: PaymentMonthSummary[]; purchases: Map<string, ActivePurchase[]>;
  subscriptions: Array<{ cardId: string; status: string }>; today: IsoDate;
}): CardListEntry[] {
  const byCard = statementsByCard(input.months);
  const payable = payableStatements(input.months, input.today);
  return input.cards.map((card) => {
    const statements = byCard.get(card.id) ?? [];
    const latestCut = statements.filter((statement) => statement.origin === "real" && statement.cutoffDate < input.today && statement.debt).at(-1);
    const openStatement = statements.find((statement) => statement.cutoffDate >= input.today);
    const period = statementPeriod({ cutoffDay: card.cutoffDay, paymentDay: card.paymentDay }, input.today);
    const purchases = input.purchases.get(card.id) ?? [];
    const pendingPrincipal = { COP: new Decimal(0), USD: new Decimal(0) };
    for (const { purchase, progress } of purchases) pendingPrincipal[purchase.currency] = pendingPrincipal[purchase.currency].plus(progress.pendingPrincipal);
    return {
      card,
      nextPayment: payable.find((statement) => statement.cardId === card.id) ?? null,
      debt: latestCut ? { cutoffDate: latestCut.cutoffDate, dueDate: latestCut.dueDate, cop: latestCut.debt!.COP, usd: latestCut.debt!.USD, estimated: estimated(latestCut) } : null,
      open: openStatement
        ? { cutoffDate: openStatement.cutoffDate, dueDate: openStatement.dueDate, cop: statementKnownTotal(openStatement), usd: statementUsdTotal(openStatement), estimated: estimated(openStatement) }
        : { cutoffDate: period.cutoffDate, dueDate: period.dueDate, cop: new Decimal(0), usd: new Decimal(0), estimated: false },
      installmentsInProgress: purchases,
      pendingPrincipal,
      subscriptions: input.subscriptions.filter((subscription) => subscription.cardId === card.id && subscription.status !== "cancelled").length,
    };
  }).sort((a, b) => a.card.name.localeCompare(b.card.name, "es") || a.card.id.localeCompare(b.card.id));
}

/** Installment purchases in progress of every card (F3), read once for all cards. */
export async function loadInstallmentPurchasesByCard(supabase: ServerClient, userId: string, today: IsoDate): Promise<Map<string, ActivePurchase[]>> {
  const purchases = await fetchAllPages((from, to) => supabase.from("transactions").select("id,card_id,merchant,currency,installments_count").eq("user_id", userId).eq("type", "purchase").gt("installments_count", 1).order("id").range(from, to)) as unknown as RawPurchase[];
  const result = new Map<string, ActivePurchase[]>();
  if (!purchases.length) return result;
  const ids = purchases.map((purchase) => purchase.id);
  const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) => ids.slice(index * 100, index * 100 + 100));
  const [installments, statements] = await Promise.all([
    Promise.all(batches.map((batch) => fetchAllPages((from, to) => supabase.from("installments").select("transaction_id,statement_id,before_tracking,number,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("user_id", userId).in("transaction_id", batch).order("id").range(from, to)))),
    fetchAllPages((from, to) => supabase.from("statements").select("id,period_start,cutoff_date,due_date").eq("user_id", userId).order("id").range(from, to)),
  ]);
  const rows = (installments.flat() as unknown as RawInstallment[]).sort((a, b) => a.number - b.number);
  const active = activeInstallmentPurchases(purchases, rows, statements as unknown as CardStatement[], today);
  for (const entry of active) {
    const cardId = purchases.find((purchase) => purchase.id === entry.purchase.id)!.card_id;
    result.set(cardId, [...result.get(cardId) ?? [], entry]);
  }
  return result;
}

export type CardList = Awaited<ReturnType<typeof loadCardList>>;

/** Tarjetas of the new interface: active cards with their four figures and archived ones apart. */
export async function loadCardList(supabase: ServerClient, userId: string, today: IsoDate) {
  const source = createSupabaseMonthSource(supabase, userId);
  const [overview, cards, subscriptions, purchases] = await Promise.all([
    loadMonthOverview(source, today),
    source.loadCardDetails(),
    source.loadSubscriptions(),
    loadInstallmentPurchasesByCard(supabase, userId, today),
  ]);
  const entries = cardListEntries({ cards, months: [...overview.history, overview.current, ...overview.future], purchases, subscriptions, today });
  return { active: entries.filter((entry) => !entry.card.archived), archived: entries.filter((entry) => entry.card.archived) };
}
