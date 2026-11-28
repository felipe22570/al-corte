import Decimal from "decimal.js";
import type { CardColor } from "@/lib/card-colors";
import type { IsoDate } from "@/lib/domain/dates";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import { statementPeriod } from "@/lib/domain/statements";
import type { ServerClient } from "@/lib/supabase/require-user";
import { loadInterestEstimates, type InterestEstimate } from "./interest-estimates";
import { loadPayInFullSavings } from "./pay-in-full-savings";
import { loadPrepaidAmounts } from "./prepayments";
import { loadCloseContext, type CloseContext } from "./statement-close";
import { loadStatementBalances, summarizeStatementBalances, type CurrencySummary, type StatementBalancesData, type StatementConceptKey } from "./statement-balances";

export type StatementCard = { id: string; name: string; last4: string; color: CardColor; cutoff_day: number; payment_day: number; interest_mode: InterestMode; archived_at: string | null };
export type SavedStatement = { id: string; period_start: IsoDate; cutoff_date: IsoDate; due_date: IsoDate };
export type StatementMovement = { id: string; type: string; source: string; merchant: string | null; date: IsoDate; currency: Currency; amount: string; amount_cop: string; installments_count: number; prepaid?: boolean };
export type StatementInstallment = { transaction_id: string; number: number; total: string; total_cop: string };
/** Charge concepts of a statement (R5), without payments, which go apart. */
export type StatementChargeConcept = Exclude<StatementConceptKey, "payments">;
export const STATEMENT_CHARGE_CONCEPTS: readonly StatementChargeConcept[] = ["single_purchases", "installments", "subscriptions", "cash_advances", "interest", "handling_fees", "insurance", "adjustments", "refunds"];

/** One line of a statement breakdown: a single-installment movement or an installment of a purchase. */
export type StatementEntry = {
  id: string;
  transactionId: string;
  kind: "movement" | "installment";
  type: string;
  merchant: string | null;
  /** Movement date; for an installment, the purchase date (missing when the purchase could not be read). */
  date?: IsoDate;
  /** Installment number and the purchase's installments; missing when the purchase could not be read. */
  number?: number;
  installmentsCount?: number;
  currency: Currency;
  /** Amount in its own currency and its COP equivalent (D33). */
  amount: string;
  amountCop: string;
  /** R9: a single-installment charge shown net of its prepayments. */
  prepaid: boolean;
};
export type StatementConceptGroup = { key: StatementChargeConcept; total: string; estimated: boolean; entries: StatementEntry[] };
export type StatementCurrencyBreakdown = { summary: CurrencySummary; concepts: StatementConceptGroup[]; payments: { total: string; entries: StatementEntry[] } };

function movementConcept(movement: StatementMovement): StatementConceptKey | null {
  if (movement.installments_count > 1) return null;
  switch (movement.type) {
    case "purchase": return movement.source === "subscription" ? "subscriptions" : "single_purchases";
    case "cash_advance": case "advance_fee": return "cash_advances";
    case "interest": case "late_interest": return "interest";
    case "handling_fee": return "handling_fees";
    case "insurance": return "insurance";
    case "adjustment": return "adjustments";
    case "refund": return "refunds";
    case "payment": return "payments";
    default: return null;
  }
}

function movementEntry(movement: StatementMovement): StatementEntry {
  return {
    id: movement.id, transactionId: movement.id, kind: "movement", type: movement.type, merchant: movement.merchant, date: movement.date,
    currency: movement.currency, amount: movement.amount, amountCop: movement.amount_cop, prepaid: !!movement.prepaid,
  };
}

/**
 * Breakdown per visible currency: charges grouped by concept with their entries (R5, D33) and payments apart. Installments
 * go with their purchase's currency; the interest concept carries the R8 estimate when there is no real interest (D32).
 */
export function buildStatementBreakdowns(input: {
  visible: CurrencySummary[]; balances: StatementBalancesData | undefined;
  movements: StatementMovement[]; installments: StatementInstallment[]; parents: StatementMovement[];
}): StatementCurrencyBreakdown[] {
  return input.visible.map((summary) => {
    const totals = input.balances?.totals[summary.currency];
    const estimated = summary.estimatedInterest.gt(0);
    const inCurrency = input.movements.filter((item) => item.currency === summary.currency);
    const concepts = STATEMENT_CHARGE_CONCEPTS.map((key): StatementConceptGroup => ({
      key,
      estimated: key === "interest" && estimated,
      total: key === "interest" && estimated ? summary.estimatedInterest.toFixed() : totals?.[key] ?? "0",
      entries: key === "installments"
        ? input.installments.flatMap((item): StatementEntry[] => {
            const parent = input.parents.find((entry) => entry.id === item.transaction_id);
            const currency = parent?.currency ?? "COP";
            if (currency !== summary.currency) return [];
            return [{
              id: `${item.transaction_id}-${item.number}`, transactionId: item.transaction_id, kind: "installment", type: parent?.type ?? "purchase",
              merchant: parent?.merchant ?? null, date: parent?.date, number: item.number, installmentsCount: parent?.installments_count,
              currency, amount: item.total, amountCop: item.total_cop, prepaid: false,
            }];
          })
        : inCurrency.filter((item) => movementConcept(item) === key).map(movementEntry),
    }));
    return {
      summary, concepts,
      payments: { total: totals?.payments ?? "0", entries: inCurrency.filter((item) => movementConcept(item) === "payments").map(movementEntry) },
    };
  });
}

/** Saved statements plus the open period (R1) define the previous and next statement of a card. */
export function statementNeighbors(saved: Array<{ period_start: IsoDate; cutoff_date: IsoDate }>, currentCutoff: IsoDate, cutoff: IsoDate, today: IsoDate) {
  const openCutoff = saved.find((item) => item.period_start <= today && today <= item.cutoff_date)?.cutoff_date ?? currentCutoff;
  const all = [...new Set([...saved.map((item) => item.cutoff_date), openCutoff])].sort();
  return { previous: all.filter((item) => item < cutoff).at(-1), next: all.find((item) => item > cutoff) };
}

export type StatementDetail = NonNullable<Awaited<ReturnType<typeof loadStatementDetail>>>;

/**
 * Everything a statement page shows (F5, F12, F15, F21, F23): balances per currency, breakdown, payments registered for it,
 * pesos paid for dollars, pay-in-full savings and the monthly close. Null when the card does not exist or the cutoff is
 * neither a saved statement nor the open period.
 */
export async function loadStatementDetail(supabase: ServerClient, userId: string, cardId: string, cutoff: IsoDate, today: IsoDate) {
  const [cardResult, statementResult, neighborsResult] = await Promise.all([
    supabase.from("cards").select("id,name,last4,color,cutoff_day,payment_day,interest_mode,archived_at").eq("id", cardId).eq("user_id", userId).maybeSingle(),
    supabase.from("statements").select("id,period_start,cutoff_date,due_date").eq("card_id", cardId).eq("user_id", userId).eq("cutoff_date", cutoff).maybeSingle(),
    supabase.from("statements").select("period_start,cutoff_date").eq("card_id", cardId).eq("user_id", userId).order("cutoff_date"),
  ]);
  if (cardResult.error || statementResult.error || neighborsResult.error) throw new Error("No pudimos consultar el extracto.");
  if (!cardResult.data) return null;
  const card = cardResult.data as StatementCard;
  const current = statementPeriod({ cutoffDay: card.cutoff_day, paymentDay: card.payment_day }, today);
  const statement = statementResult.data as unknown as SavedStatement | null;
  if (!statement && cutoff !== current.cutoffDate) return null;
  const neighbors = statementNeighbors(neighborsResult.data ?? [], current.cutoffDate, cutoff, today);
  let movements: StatementMovement[] = [];
  let installments: StatementInstallment[] = [];
  let parents: StatementMovement[] = [];
  let balances: StatementBalancesData | undefined;
  // D32: without a registered interest charge, an on-balance statement carries the R8 estimate in its minimum payment.
  let estimate: InterestEstimate | undefined;
  // D37: payments registered for this statement, wherever their date places them (R1).
  const paidFor: Partial<Record<Currency, Decimal>> = {};
  // D56: dollars of this statement paid with the pesos debited.
  let paidWithPesos = { usd: new Decimal(0), cop: new Decimal(0) };
  if (statement) {
    const [movementsResult, installmentsResult, balancesByStatement, paidForResult] = await Promise.all([
      supabase.from("transactions").select("id,type,source,merchant,date,currency,amount::text,amount_cop::text,installments_count").eq("statement_id", statement.id).eq("user_id", userId).order("date"),
      supabase.from("installments").select("transaction_id,number,total::text,total_cop::text").eq("statement_id", statement.id).eq("user_id", userId).order("number"),
      loadStatementBalances(supabase, userId, [statement.id]),
      supabase.from("transactions").select("currency,amount::text,amount_cop::text,cop_debited").eq("paid_statement_id", statement.id).eq("user_id", userId).eq("type", "payment"),
    ]);
    if (movementsResult.error || installmentsResult.error || paidForResult.error) throw new Error("No pudimos consultar los movimientos del extracto.");
    movements = (movementsResult.data ?? []) as unknown as StatementMovement[];
    for (const payment of (paidForResult.data ?? []) as unknown as Array<{ currency: Currency; amount: string; amount_cop: string; cop_debited: boolean }>) {
      paidFor[payment.currency] = (paidFor[payment.currency] ?? new Decimal(0)).plus(payment.amount);
      if (payment.cop_debited) paidWithPesos = { usd: paidWithPesos.usd.plus(payment.amount), cop: paidWithPesos.cop.plus(payment.amount_cop) };
    }
    // R9: a single-installment charge shows what is left after its prepayments, as the statement totals do.
    const singles = movements.filter((item) => item.installments_count === 1 && item.type !== "payment" && item.type !== "refund");
    const prepaid = singles.length ? await loadPrepaidAmounts(supabase, userId, singles.map((item) => item.id)) : new Map();
    movements = movements.map((item) => {
      const applied = item.installments_count === 1 ? prepaid.get(item.id) : undefined;
      return applied ? { ...item, prepaid: true, amount: new Decimal(item.amount).minus(applied.amount).toFixed(), amount_cop: new Decimal(item.amount_cop).minus(applied.amountCop).toFixed() } : item;
    });
    installments = (installmentsResult.data ?? []) as unknown as StatementInstallment[];
    balances = balancesByStatement.get(statement.id);
    if (installments.length) {
      const result = await supabase.from("transactions").select("id,type,source,merchant,date,currency,amount::text,amount_cop::text,installments_count").eq("user_id", userId).in("id", installments.map((item) => item.transaction_id));
      if (result.error) throw new Error("No pudimos consultar las compras a cuotas.");
      parents = (result.data ?? []) as unknown as StatementMovement[];
    }
    if (card.interest_mode === "on_balance") estimate = (await loadInterestEstimates(supabase, userId, [statement])).get(statement.id);
  }
  const { summaries, paidAt } = summarizeStatementBalances(balances, estimate);
  const cop = summaries.find((item) => item.currency === "COP")!;
  const usd = summaries.find((item) => item.currency === "USD");
  // D33: pesos lead; a statement with charges only in dollars leads with dollars instead of "$0".
  const headline = !cop.hasCharges && usd?.hasCharges ? usd : cop;
  const secondary = headline === cop && usd?.hasCharges ? usd : null;
  // Currencies with charges; pesos when there are none yet.
  const visible = summaries.filter((summary) => summary.hasCharges || (summary.currency === "COP" && !summaries.some((item) => item.hasCharges)));
  const closed = cutoff < today;
  // F21: interest avoided by paying the total debt, for cut statements with that currency still unpaid (D54).
  const savingsCurrencies = statement && closed ? visible.filter((summary) => !summary.paidAt).map((summary) => summary.currency) : [];
  const savings = statement && savingsCurrencies.length ? (await loadPayInFullSavings(supabase, userId, [{ id: statement.id, cardId, cutoffDate: cutoff, currencies: savingsCurrencies }], today)).get(statement.id) : undefined;
  // F15: the monthly close, once the statement is cut, for each currency with charges (D39).
  const closeContexts: CloseContext[] = statement && closed
    ? (await Promise.all(visible.map((summary) => loadCloseContext(supabase, userId, statement.id, summary.currency)))).flatMap((item) => item ? [item] : [])
    : [];
  return {
    card, statement, cutoff, closed, neighbors,
    /** Dates of the statement, or of the open period (R1) while it is not saved yet. */
    period: { periodStart: statement?.period_start ?? current.periodStart, cutoffDate: cutoff, dueDate: statement?.due_date ?? current.dueDate },
    summaries, paidAt, headline, secondary, visible,
    hasEstimatedInterest: summaries.some((summary) => summary.estimatedInterest.gt(0)),
    breakdowns: buildStatementBreakdowns({ visible, balances, movements, installments, parents }),
    paidFor, paidWithPesos, savings, closeContexts,
  };
}
