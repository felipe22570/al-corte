import Decimal from "decimal.js";
import { addDays, addMonths, compareIsoDates, daysInMonth, monthKey, parseIsoDate, type IsoDate } from "./dates";
import { statementPaidAt } from "./balances";
import { estimateBalanceInterest, type BalanceInterestInstallment, type InterestMode } from "./interest";
import { toCop, type Currency } from "./money";
import { statementPeriod, shiftStatement } from "./statements";
import { chargeDatesBetween, type Frequency, type SubscriptionStatus } from "./subscriptions";
import { compareMonths, monthlySpending, statementItemsFromMovements, statementTotals, type StatementConcept } from "./totals";

export type ProjectableSubscription = {
  startDate: IsoDate;
  frequency: Frequency;
  billingDay: number;
  status: SubscriptionStatus;
  trialEndsAt?: IsoDate | null;
  cardArchived: boolean;
};

export function paymentMonth(dueDate: IsoDate): string {
  return monthKey(dueDate);
}

export function parsePaymentMonth(value: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  try {
    return monthKey(`${value}-01`);
  } catch {
    return null;
  }
}

export function previousPaymentMonth(month: string): string | null {
  if (month === "0001-01") return null;
  return paymentMonth(addMonths(`${month}-01`, -1));
}

export function monthDateBounds(month: string): { first: IsoDate; last: IsoDate } {
  const first = `${month}-01`;
  const { year, month: number } = parseIsoDate(first);
  return { first, last: `${month}-${daysInMonth(year, number)}` };
}

export function purchaseMonthSpending(transactions: Parameters<typeof monthlySpending>[0], month: string): Decimal {
  return monthlySpending(transactions, month);
}

export function availablePaymentMonths(today: IsoDate, savedDueDates: IsoDate[], futureMonths: string[]): string[] {
  const current = paymentMonth(today);
  const end = paymentMonth(addMonths(`${current}-01`, 12));
  return [...new Set([
    current,
    ...savedDueDates.map(paymentMonth).filter((month) => month < current),
    ...futureMonths.filter((month) => month > current && month <= end && parsePaymentMonth(month) !== null),
  ])].sort();
}

export function historyMonthCapacity(blocks: string | undefined): number {
  if (!blocks || !/^[1-9]\d*$/.test(blocks)) return 12;
  const capacity = Number(blocks) * 12;
  return Number.isSafeInteger(capacity) ? capacity : 12;
}

export function historyMonthNextBlock(blocks: string | undefined): string {
  return String(historyMonthCapacity(blocks) / 12 + 1);
}

export function historyMonthPage(dueDates: IsoDate[], today: IsoDate, pageSize: number, before?: string): { months: string[]; nextBefore: string | null } {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error("Tamaño de página inválido");
  const currentMonth = monthKey(today);
  if (before !== undefined) monthKey(`${before}-01`);
  const months = [...new Set(dueDates.map(paymentMonth))]
    .filter((month) => month < currentMonth && (before === undefined || month < before))
    .sort((a, b) => b.localeCompare(a));
  const page = months.slice(0, pageSize);
  return { months: page, nextBefore: months.length > pageSize ? page[page.length - 1]! : null };
}

export function selectMonthStatementScope<T extends { dueDate: IsoDate; paidAt: string | null }>(
  statements: T[], today: IsoDate, pageSize: number, before?: string,
) {
  const history = historyMonthPage(statements.map((statement) => statement.dueDate), today, pageSize, before);
  const current = paymentMonth(today);
  const selected = new Set(history.months);
  return {
    history,
    statements: statements.filter((statement) =>
      paymentMonth(statement.dueDate) >= current || selected.has(paymentMonth(statement.dueDate))
      || (!statement.paidAt && compareIsoDates(statement.dueDate, today) < 0)),
  };
}

export function isWithinMonthProjectionWindow(dueDate: IsoDate, today: IsoDate): boolean {
  const current = paymentMonth(today);
  const end = paymentMonth(addMonths(`${current}-01`, 12));
  return paymentMonth(dueDate) <= end;
}

export function projectSubscriptionCharges(
  subscription: ProjectableSubscription,
  from: IsoDate,
  to: IsoDate,
): IsoDate[] {
  if (subscription.cardArchived) return [];
  return chargeDatesBetween(subscription, from, to);
}

export type UnconvertedCharge = {
  subscriptionId: string;
  date: IsoDate;
  amountUsd: Decimal;
};

export type MonthStatement = {
  id?: string;
  cardId: string;
  origin: "real" | "virtual";
  periodStart?: IsoDate;
  cutoffDate: IsoDate;
  dueDate: IsoDate;
  /** Paid when every currency with charges is marked (D33). */
  paidAt: string | null;
  /** Payment mark per currency; a missing currency falls back to `paidAt`. */
  paidByCurrency?: Partial<Record<Currency, string | null>>;
  /** Charges in pesos (D33): registered in the statement and projected. */
  recordedTotal: Decimal;
  projectedTotal: Decimal;
  /** Charges in dollars, never converted into the peso totals (D33). */
  recordedUsd?: Decimal;
  projectedUsd?: Decimal;
  /** COP reference for the dollar charges; incomplete when `unconvertedCharges` is not empty. */
  usdEquivalentCop?: Decimal;
  /** Total debt per currency at the cutoff (R8): minimum payment plus principal still to be billed. Real statements only. */
  debt?: Record<Currency, Decimal>;
  unconvertedCharges: UnconvertedCharge[];
  charges?: MonthCharge[];
};

/** Peso total of the statement (minimum payment in COP, D33). */
export function statementKnownTotal(statement: Pick<MonthStatement, "recordedTotal" | "projectedTotal">): Decimal {
  return statement.recordedTotal.plus(statement.projectedTotal);
}

/** Dollar total of the statement, shown apart from the peso total (D33). */
export function statementUsdTotal(statement: Pick<MonthStatement, "recordedUsd" | "projectedUsd">): Decimal {
  return (statement.recordedUsd ?? new Decimal(0)).plus(statement.projectedUsd ?? new Decimal(0));
}

/** Payment mark of one currency of a statement (D33). */
export function currencyPaidAt(statement: Pick<MonthStatement, "paidAt" | "paidByCurrency">, currency: Currency): string | null {
  const mark = statement.paidByCurrency?.[currency];
  return mark === undefined ? statement.paidAt : mark;
}

export type MonthCharge = {
  id: string;
  origin: "real" | "projected";
  concept: StatementConcept;
  categoryId: string | null;
  amountCop: Decimal | null;
  amount?: Decimal;
  currency?: Currency;
  fxRate?: Decimal | null;
  subscriptionId?: string;
  date?: IsoDate;
  /** On-balance interest estimated by R8 because the real one is not registered yet; part of the calculated total. */
  estimated?: boolean;
};

type ProjectionCard = {
  id: string; cutoffDay: number; paymentDay: number; archived: boolean; handlingFee: Decimal; interestMode?: InterestMode;
};
type SavedStatement = {
  id: string; cardId: string; periodStart: IsoDate; cutoffDate: IsoDate; dueDate: IsoDate;
  /** Paid in every currency with charges; without `paidByCurrency` it applies to all currencies. */
  paidAt: string | null;
  paidByCurrency?: Partial<Record<Currency, string | null>>;
  /** Principal still to be billed after this statement, per currency (statement_currency_totals). */
  pendingPrincipal?: Partial<Record<Currency, Decimal>>;
};
type Movement = Parameters<typeof statementItemsFromMovements>[0][number] & {
  id: string; statementId: string; categoryId: string | null; subscriptionId?: string | null; date: IsoDate;
  amount?: Decimal; currency?: Currency; fxRate?: Decimal | null;
};
type Installment = {
  id: string; statementId: string; categoryId: string | null; totalCop: Decimal;
  /** Installment total in the purchase currency (D33); defaults to `totalCop` in COP. */
  total?: Decimal; currency?: Currency;
  /** Needed only for on-balance cards (D32). */
  interestBasis?: BalanceInterestInstallment;
};
type ProjectionSubscription = Omit<ProjectableSubscription, "cardArchived"> & {
  id: string; cardId: string; categoryId: string | null; amount: Decimal; currency: Currency;
};
export type ProjectionInput = {
  cards: ProjectionCard[]; statements: SavedStatement[]; movements: Movement[]; installments: Installment[];
  subscriptions: ProjectionSubscription[];
  /** Resolved by the caller using D4, or null when unavailable. */
  fxRate: Decimal | null;
  today: IsoDate;
};
export type ProjectedStatement = MonthStatement & { charges: MonthCharge[]; recordedUsd: Decimal; projectedUsd: Decimal; usdEquivalentCop: Decimal };

const CURRENCIES: Currency[] = ["COP", "USD"];
function chargeCurrency(charge: MonthCharge): Currency {
  return charge.currency ?? "COP";
}
/** Amount of the charge in `currency`, or null when it is billed in the other one (D33). */
function chargeAmountIn(charge: MonthCharge, currency: Currency): Decimal | null {
  if (chargeCurrency(charge) !== currency) return null;
  return charge.amount ?? charge.amountCop;
}
function totalIn(charges: MonthCharge[], currency: Currency): Decimal {
  return statementTotals(charges.flatMap((charge) => {
    const amount = chargeAmountIn(charge, currency);
    return amount === null ? [] : [{ concept: charge.concept, amountCop: amount }];
  })).total;
}

export function projectStatements(input: ProjectionInput): { statements: ProjectedStatement[]; hasLaterCommitments: boolean } {
  const currentMonth = monthKey(input.today);
  const lastMonth = monthKey(addMonths(`${currentMonth}-01`, 12));
  const endDate = addDays(addMonths(`${lastMonth}-01`, 1), -1);
  const chargesByStatement = new Map<string, Array<MonthCharge & { amountCop: Decimal }>>();
  const realChargeKeys = new Set<string>();

  for (const movement of input.movements) {
    if (movement.subscriptionId) realChargeKeys.add(`${movement.subscriptionId}:${movement.date}`);
    const item = statementItemsFromMovements([movement], [])[0];
    if (!item) continue;
    const charges = chargesByStatement.get(movement.statementId) ?? [];
    charges.push({ id: movement.id, origin: "real", concept: item.concept, categoryId: movement.categoryId,
      amountCop: item.amountCop, amount: movement.amount ?? item.amountCop, currency: movement.currency ?? "COP", fxRate: movement.fxRate,
      subscriptionId: movement.subscriptionId ?? undefined, date: movement.date });
    chargesByStatement.set(movement.statementId, charges);
  }
  const interestBasis = new Map<string, BalanceInterestInstallment[]>();
  for (const installment of input.installments) {
    const charges = chargesByStatement.get(installment.statementId) ?? [];
    charges.push({ id: installment.id, origin: "real", concept: "installments", categoryId: installment.categoryId, amountCop: installment.totalCop,
      amount: installment.total ?? installment.totalCop, currency: installment.currency ?? "COP" });
    chargesByStatement.set(installment.statementId, charges);
    if (installment.interestBasis) interestBasis.set(installment.statementId, [...interestBasis.get(installment.statementId) ?? [], installment.interestBasis]);
  }
  const interestModes = new Map(input.cards.map((card) => [card.id, card.interestMode]));

  const result: ProjectedStatement[] = input.statements.filter((s) => paymentMonth(s.dueDate) <= lastMonth).map((s) => {
    const charges = chargesByStatement.get(s.id) ?? [];
    // D32: without a real interest charge, on-balance statements carry the R8 estimate in their calculated total.
    if (interestModes.get(s.cardId) === "on_balance" && !charges.some((charge) => charge.concept === "interest")) {
      const estimate = estimateBalanceInterest(interestBasis.get(s.id) ?? [], s.periodStart);
      for (const currency of CURRENCIES) {
        if (estimate.byCurrency[currency].gt(0)) charges.push({ id: `interest:${s.id}:${currency}`, origin: "real", concept: "interest", categoryId: null,
          amount: estimate.byCurrency[currency], currency, amountCop: estimate.copByCurrency[currency], estimated: true });
      }
    }
    const recordedTotal = totalIn(charges, "COP");
    const recordedUsd = totalIn(charges, "USD");
    const paidByCurrency = { COP: s.paidByCurrency?.COP ?? s.paidAt, USD: s.paidByCurrency?.USD ?? s.paidAt };
    const currencies = CURRENCIES.filter((currency) => charges.some((charge) => charge.concept !== "payments" && chargeCurrency(charge) === currency));
    const statement: ProjectedStatement = {
      id: s.id, cardId: s.cardId, periodStart: s.periodStart, cutoffDate: s.cutoffDate, dueDate: s.dueDate,
      origin: "real", paidAt: statementPaidAt(paidByCurrency, currencies), paidByCurrency,
      recordedTotal, projectedTotal: new Decimal(0), recordedUsd, projectedUsd: new Decimal(0),
      usdEquivalentCop: statementTotals(charges.filter((charge) => chargeCurrency(charge) === "USD").map((charge) => ({ concept: charge.concept, amountCop: charge.amountCop }))).total,
      unconvertedCharges: [], charges,
    };
    if (s.pendingPrincipal) statement.debt = { COP: recordedTotal.plus(s.pendingPrincipal.COP ?? 0), USD: recordedUsd.plus(s.pendingPrincipal.USD ?? 0) };
    return statement;
  });
  const hasLaterCommitments = input.statements.some((s) => paymentMonth(s.dueDate) > lastMonth);
  const byCutoff = new Map(result.map((s) => [`${s.cardId}:${s.cutoffDate}`, s]));
  const savedCutoffs = new Set(input.statements.map((s) => `${s.cardId}:${s.cutoffDate}`));

  function getStatement(card: ProjectionCard, date: IsoDate): ProjectedStatement | null {
    const period = statementPeriod(card, date);
    const key = `${card.id}:${period.cutoffDate}`;
    const existing = byCutoff.get(key);
    if (existing) return paymentMonth(existing.dueDate) >= currentMonth && paymentMonth(existing.dueDate) <= lastMonth ? existing : null;
    if (savedCutoffs.has(key)) return null;
    const dueMonth = paymentMonth(period.dueDate);
    if (dueMonth < currentMonth || dueMonth > lastMonth) return null;
    const statement: ProjectedStatement = {
      cardId: card.id, origin: "virtual", ...period, paidAt: null,
      recordedTotal: new Decimal(0), projectedTotal: new Decimal(0), recordedUsd: new Decimal(0), projectedUsd: new Decimal(0),
      usdEquivalentCop: new Decimal(0), unconvertedCharges: [], charges: [],
    };
    byCutoff.set(key, statement);
    result.push(statement);
    if (card.handlingFee.gt(0)) {
      statement.projectedTotal = statement.projectedTotal.plus(card.handlingFee);
      statement.charges.push({ id: `handling:${key}`, origin: "projected", concept: "handling_fees", categoryId: null, amountCop: card.handlingFee, amount: card.handlingFee, currency: "COP" });
    }
    return statement;
  }

  for (const card of input.cards) {
    if (card.archived) continue;
    if (card.handlingFee.gt(0)) {
      let cutoff = statementPeriod(card, input.today).cutoffDate;
      while (cutoff <= endDate) {
        getStatement(card, cutoff);
        cutoff = shiftStatement(card.cutoffDay, cutoff, 1);
      }
    }
    for (const subscription of input.subscriptions.filter((s) => s.cardId === card.id)) {
      const dates = projectSubscriptionCharges({ ...subscription, cardArchived: card.archived }, input.today, endDate);
      for (const date of dates) {
        if (realChargeKeys.has(`${subscription.id}:${date}`)) continue;
        const statement = getStatement(card, date);
        if (!statement) continue;
        const amountCop = subscription.currency === "USD"
          ? input.fxRate === null ? null : toCop(subscription.amount, "USD", input.fxRate)
          : toCop(subscription.amount, "COP");
        statement.charges.push({ id: `subscription:${subscription.id}:${date}`, origin: "projected", concept: "subscriptions",
          categoryId: subscription.categoryId, amountCop, amount: subscription.amount, currency: subscription.currency,
          fxRate: subscription.currency === "USD" ? input.fxRate : null, subscriptionId: subscription.id, date });
        // D33: dollar projections stay in dollars; without TRM only their COP reference is missing.
        if (subscription.currency === "COP") statement.projectedTotal = statement.projectedTotal.plus(subscription.amount);
        else {
          statement.projectedUsd = statement.projectedUsd.plus(subscription.amount);
          if (amountCop) statement.usdEquivalentCop = statement.usdEquivalentCop.plus(amountCop);
          else statement.unconvertedCharges.push({ subscriptionId: subscription.id, date, amountUsd: subscription.amount });
        }
      }
    }
  }
  return { statements: result, hasLaterCommitments };
}

export type PaymentMonthSummary = {
  month: string;
  kind: "past" | "current" | "future";
  status: "overdue" | "pending" | "paid" | "estimated" | null;
  statements: MonthStatement[];
  /** Pesos to pay in the month (D33); dollars go apart in `totalUsd`. */
  total: Decimal;
  billed: Decimal;
  openRecorded: Decimal;
  projected: Decimal;
  pendingConfirmation: Decimal;
  totalUsd: Decimal;
  /** Dollar part of `totalUsd` that is still projected. */
  projectedUsd: Decimal;
  pendingConfirmationUsd: Decimal;
  /** COP reference for the dollar charges, complete only when `complete`. */
  usdEquivalentCop: Decimal;
  /** Total debt of the month's real statements per currency (R8), secondary data; null without real statements. */
  debt: Record<Currency, Decimal> | null;
  /** False when some dollar projection lacks TRM: only the COP reference is incomplete (D33). */
  complete: boolean;
  unconvertedCharges: UnconvertedCharge[];
  hasOpenStatements: boolean;
  hasProjection: boolean;
  cards: MonthCardSummary[];
  canUseProportionalBar: boolean;
};

export type MonthCardSummary = {
  cardId: string;
  total: Decimal;
  totalUsd: Decimal;
  complete: boolean;
  statements: Array<{ statement: MonthStatement; status: "virtual" | "paid" | "overdue" | "pending" }>;
};

/** Calculated total of real statements already marked as paid (D26); not a payment balance. */
export function confirmedPaymentTotal(month: PaymentMonthSummary): Decimal {
  return month.statements.reduce((sum, statement) =>
    statement.origin === "real" && currencyPaidAt(statement, "COP") ? sum.plus(statement.recordedTotal) : sum, new Decimal(0));
}

/** "Aún puede crecer" (D19): recorded in open statements plus known projected charges. */
export function monthOpenGrowth(month: PaymentMonthSummary): Decimal {
  return month.openRecorded.plus(month.projected);
}

export function cardCompositionPercentages(month: PaymentMonthSummary): Array<{ cardId: string; percent: number }> | null {
  if (!month.canUseProportionalBar) return null;
  const shares = month.cards.map((card, index) => {
    const exact = card.total.div(month.total).times(100);
    const rounded = exact.floor();
    return { cardId: card.cardId, index, percent: rounded.toNumber(), remainder: exact.minus(rounded) };
  });
  const remaining = 100 - shares.reduce((sum, item) => sum + item.percent, 0);
  const byRemainder = [...shares].sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);
  for (const item of byRemainder.slice(0, remaining)) item.percent += 1;
  return shares.map(({ cardId, percent }) => ({ cardId, percent }));
}

export function buildMonths(statements: MonthStatement[], today: IsoDate): PaymentMonthSummary[] {
  const currentMonth = monthKey(today);
  const groups = new Map<string, MonthStatement[]>([[currentMonth, []]]);
  for (const statement of statements) {
    const month = paymentMonth(statement.dueDate);
    const group = groups.get(month) ?? [];
    group.push(statement);
    groups.set(month, group);
  }

  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([month, group]) => {
    const kind = month < currentMonth ? "past" : month > currentMonth ? "future" : "current";
    let billed = new Decimal(0);
    let openRecorded = new Decimal(0);
    let projected = new Decimal(0);
    let pendingConfirmation = new Decimal(0);
    let totalUsd = new Decimal(0);
    let pendingConfirmationUsd = new Decimal(0);
    let projectedUsd = new Decimal(0);
    let usdEquivalentCop = new Decimal(0);
    const debt = { COP: new Decimal(0), USD: new Decimal(0) };
    let hasDebt = false;
    let hasOverdue = false;
    let hasUnpaid = false;
    let hasProjection = false;
    const unconvertedCharges: UnconvertedCharge[] = [];
    const cards = new Map<string, MonthCardSummary>();

    for (const statement of group) {
      const card = cards.get(statement.cardId) ?? { cardId: statement.cardId, total: new Decimal(0), totalUsd: new Decimal(0), complete: true, statements: [] };
      const status = statement.origin === "virtual" ? "virtual" : statement.paidAt ? "paid"
        : compareIsoDates(statement.dueDate, today) < 0 ? "overdue" : "pending";
      card.statements.push({ statement, status });
      if (statement.origin === "real") card.total = card.total.plus(statement.recordedTotal);
      card.total = card.total.plus(statement.projectedTotal);
      card.totalUsd = card.totalUsd.plus(statementUsdTotal(statement));
      totalUsd = totalUsd.plus(statementUsdTotal(statement));
      projectedUsd = projectedUsd.plus(statement.projectedUsd ?? 0);
      usdEquivalentCop = usdEquivalentCop.plus(statement.usdEquivalentCop ?? 0);
      card.complete = card.complete && statement.unconvertedCharges.length === 0;
      cards.set(statement.cardId, card);
      if (statement.origin === "real") {
        if (compareIsoDates(statement.cutoffDate, today) < 0) billed = billed.plus(statement.recordedTotal);
        else openRecorded = openRecorded.plus(statement.recordedTotal);
        if (!currencyPaidAt(statement, "COP")) pendingConfirmation = pendingConfirmation.plus(statement.recordedTotal);
        if (!currencyPaidAt(statement, "USD")) pendingConfirmationUsd = pendingConfirmationUsd.plus(statement.recordedUsd ?? 0);
        if (!statement.paidAt) {
          hasUnpaid = true;
          if (compareIsoDates(statement.dueDate, today) < 0) hasOverdue = true;
        }
        if (statement.debt) {
          hasDebt = true;
          debt.COP = debt.COP.plus(statement.debt.COP);
          debt.USD = debt.USD.plus(statement.debt.USD);
        }
      }
      projected = projected.plus(statement.projectedTotal);
      unconvertedCharges.push(...statement.unconvertedCharges);
      if (statement.origin === "virtual" || !statement.projectedTotal.isZero() || statement.unconvertedCharges.length > 0
        || statement.charges?.some((charge) => charge.origin === "projected")) hasProjection = true;
    }

    const status = kind === "future" ? "estimated"
      : hasOverdue ? "overdue"
        : hasUnpaid || hasProjection ? "pending"
          : group.length > 0 ? "paid" : null;
    return {
      month, kind, status, statements: group,
      total: billed.plus(openRecorded).plus(projected),
      billed, openRecorded, projected, pendingConfirmation, totalUsd, projectedUsd, pendingConfirmationUsd, usdEquivalentCop, debt: hasDebt ? debt : null,
      complete: unconvertedCharges.length === 0, unconvertedCharges,
      hasOpenStatements: group.some((statement) => compareIsoDates(statement.cutoffDate, today) >= 0),
      hasProjection, cards: [...cards.values()],
      canUseProportionalBar: billed.plus(openRecorded).plus(projected).gt(0) && [...cards.values()].every((card) => card.total.gte(0)),
    };
  });
}

/** Breakdown of the month's charges in one currency (D28, D33): pesos by default, dollars apart. */
export function monthBreakdown(statements: MonthStatement[], currency: Currency = "COP") {
  const names: StatementConcept[] = ["single_purchases", "installments", "subscriptions", "cash_advances", "interest", "handling_fees", "insurance", "adjustments", "refunds", "payments"];
  const concepts = Object.fromEntries(names.map((name) => [name, new Decimal(0)])) as Record<StatementConcept, Decimal>;
  const categories = new Map<string | null, Decimal>();
  let total = new Decimal(0);
  let payments = new Decimal(0);
  let estimatedInterest = false;
  for (const statement of statements) {
    for (const charge of statement.charges ?? []) {
      const value = chargeAmountIn(charge, currency);
      if (value === null) continue;
      if (charge.estimated) estimatedInterest = true;
      if (charge.concept === "payments") {
        payments = payments.plus(value);
        concepts.payments = concepts.payments.plus(value);
        continue;
      }
      const amount = charge.concept === "refunds" ? value.negated() : value;
      concepts[charge.concept] = concepts[charge.concept].plus(amount);
      categories.set(charge.categoryId, (categories.get(charge.categoryId) ?? new Decimal(0)).plus(amount));
      total = total.plus(amount);
    }
  }
  return { concepts, categories, total, payments, estimatedInterest };
}

export function overdueStatements(statements: MonthStatement[], today: IsoDate) {
  const months = new Map<string, MonthStatement[]>();
  let total = new Decimal(0);
  let totalUsd = new Decimal(0);
  for (const statement of statements) {
    const month = paymentMonth(statement.dueDate);
    if (statement.origin !== "real" || statement.paidAt || month >= monthKey(today) || compareIsoDates(statement.dueDate, today) >= 0) continue;
    const group = months.get(month) ?? [];
    group.push(statement);
    months.set(month, group);
    if (!currencyPaidAt(statement, "COP")) total = total.plus(statement.recordedTotal);
    if (!currencyPaidAt(statement, "USD")) totalUsd = totalUsd.plus(statement.recordedUsd ?? 0);
  }
  return { months, total, totalUsd };
}

export function monthComparison(current: PaymentMonthSummary | undefined, previous: PaymentMonthSummary | undefined) {
  if (!current || !previous || current.kind === "future" || previous.kind === "future"
    || current.statements.length === 0 || previous.statements.length === 0
    || current.hasOpenStatements || previous.hasOpenStatements || current.hasProjection || previous.hasProjection
    || monthKey(addMonths(`${current.month}-01`, -1)) !== previous.month) {
    return { kind: "unavailable" as const };
  }
  // D33: pesos and dollars are compared separately; a missing TRM no longer blocks the comparison.
  const usd = current.totalUsd.isZero() && previous.totalUsd.isZero() ? null : compareMonths(current.totalUsd, previous.totalUsd);
  return { kind: "comparable" as const, ...compareMonths(current.total, previous.total), usd };
}
