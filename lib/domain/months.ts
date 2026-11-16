import Decimal from "decimal.js";
import { addDays, addMonths, compareIsoDates, daysInMonth, monthKey, parseIsoDate, type IsoDate } from "./dates";
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
  paidAt: string | null;
  recordedTotal: Decimal;
  projectedTotal: Decimal;
  unconvertedCharges: UnconvertedCharge[];
  charges?: MonthCharge[];
};

export function statementKnownTotal(statement: Pick<MonthStatement, "recordedTotal" | "projectedTotal">): Decimal {
  return statement.recordedTotal.plus(statement.projectedTotal);
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
};

type ProjectionCard = {
  id: string; cutoffDay: number; paymentDay: number; archived: boolean; handlingFee: Decimal;
};
type SavedStatement = {
  id: string; cardId: string; periodStart: IsoDate; cutoffDate: IsoDate; dueDate: IsoDate; paidAt: string | null;
};
type Movement = Parameters<typeof statementItemsFromMovements>[0][number] & {
  id: string; statementId: string; categoryId: string | null; subscriptionId?: string | null; date: IsoDate;
  amount?: Decimal; currency?: Currency; fxRate?: Decimal | null;
};
type Installment = {
  id: string; statementId: string; categoryId: string | null; totalCop: Decimal;
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
export type ProjectedStatement = MonthStatement & { charges: MonthCharge[] };

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
      amountCop: item.amountCop, amount: movement.amount, currency: movement.currency, fxRate: movement.fxRate,
      subscriptionId: movement.subscriptionId ?? undefined, date: movement.date });
    chargesByStatement.set(movement.statementId, charges);
  }
  for (const installment of input.installments) {
    const charges = chargesByStatement.get(installment.statementId) ?? [];
    charges.push({ id: installment.id, origin: "real", concept: "installments", categoryId: installment.categoryId, amountCop: installment.totalCop });
    chargesByStatement.set(installment.statementId, charges);
  }

  const result: ProjectedStatement[] = input.statements.filter((s) => paymentMonth(s.dueDate) <= lastMonth).map((s) => {
    const charges = chargesByStatement.get(s.id) ?? [];
    const total = statementTotals(charges.map((charge) => ({ concept: charge.concept, amountCop: charge.amountCop }))).total;
    return { ...s, origin: "real", recordedTotal: total, projectedTotal: new Decimal(0), unconvertedCharges: [], charges };
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
      recordedTotal: new Decimal(0), projectedTotal: new Decimal(0), unconvertedCharges: [], charges: [],
    };
    byCutoff.set(key, statement);
    result.push(statement);
    if (card.handlingFee.gt(0)) {
      statement.projectedTotal = statement.projectedTotal.plus(card.handlingFee);
      statement.charges.push({ id: `handling:${key}`, origin: "projected", concept: "handling_fees", categoryId: null, amountCop: card.handlingFee });
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
        if (amountCop) statement.projectedTotal = statement.projectedTotal.plus(amountCop);
        else statement.unconvertedCharges.push({ subscriptionId: subscription.id, date, amountUsd: subscription.amount });
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
  total: Decimal;
  billed: Decimal;
  openRecorded: Decimal;
  projected: Decimal;
  pendingConfirmation: Decimal;
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
  complete: boolean;
  statements: Array<{ statement: MonthStatement; status: "virtual" | "paid" | "overdue" | "pending" }>;
};

/** Calculated total of real statements already marked as paid (D26); not a payment balance. */
export function confirmedPaymentTotal(month: PaymentMonthSummary): Decimal {
  return month.statements.reduce((sum, statement) =>
    statement.origin === "real" && statement.paidAt ? sum.plus(statement.recordedTotal) : sum, new Decimal(0));
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
    let hasOverdue = false;
    let hasUnpaid = false;
    let hasProjection = false;
    const unconvertedCharges: UnconvertedCharge[] = [];
    const cards = new Map<string, MonthCardSummary>();

    for (const statement of group) {
      const card = cards.get(statement.cardId) ?? { cardId: statement.cardId, total: new Decimal(0), complete: true, statements: [] };
      const status = statement.origin === "virtual" ? "virtual" : statement.paidAt ? "paid"
        : compareIsoDates(statement.dueDate, today) < 0 ? "overdue" : "pending";
      card.statements.push({ statement, status });
      if (statement.origin === "real") card.total = card.total.plus(statement.recordedTotal);
      card.total = card.total.plus(statement.projectedTotal);
      card.complete = card.complete && statement.unconvertedCharges.length === 0;
      cards.set(statement.cardId, card);
      if (statement.origin === "real") {
        if (compareIsoDates(statement.cutoffDate, today) < 0) billed = billed.plus(statement.recordedTotal);
        else openRecorded = openRecorded.plus(statement.recordedTotal);
        if (!statement.paidAt) {
          pendingConfirmation = pendingConfirmation.plus(statement.recordedTotal);
          hasUnpaid = true;
          if (compareIsoDates(statement.dueDate, today) < 0) hasOverdue = true;
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
      billed, openRecorded, projected, pendingConfirmation,
      complete: unconvertedCharges.length === 0, unconvertedCharges,
      hasOpenStatements: group.some((statement) => compareIsoDates(statement.cutoffDate, today) >= 0),
      hasProjection, cards: [...cards.values()],
      canUseProportionalBar: billed.plus(openRecorded).plus(projected).gt(0) && [...cards.values()].every((card) => card.total.gte(0)),
    };
  });
}

export function monthBreakdown(statements: MonthStatement[]) {
  const names: StatementConcept[] = ["single_purchases", "installments", "subscriptions", "cash_advances", "interest", "handling_fees", "insurance", "adjustments", "refunds", "payments"];
  const concepts = Object.fromEntries(names.map((name) => [name, new Decimal(0)])) as Record<StatementConcept, Decimal>;
  const categories = new Map<string | null, Decimal>();
  let total = new Decimal(0);
  let payments = new Decimal(0);
  for (const statement of statements) {
    for (const charge of statement.charges ?? []) {
      if (charge.amountCop === null) continue;
      if (charge.concept === "payments") {
        payments = payments.plus(charge.amountCop);
        concepts.payments = concepts.payments.plus(charge.amountCop);
        continue;
      }
      const amount = charge.concept === "refunds" ? charge.amountCop.negated() : charge.amountCop;
      concepts[charge.concept] = concepts[charge.concept].plus(amount);
      categories.set(charge.categoryId, (categories.get(charge.categoryId) ?? new Decimal(0)).plus(amount));
      total = total.plus(amount);
    }
  }
  return { concepts, categories, total, payments };
}

export function overdueStatements(statements: MonthStatement[], today: IsoDate) {
  const months = new Map<string, MonthStatement[]>();
  let total = new Decimal(0);
  for (const statement of statements) {
    const month = paymentMonth(statement.dueDate);
    if (statement.origin !== "real" || statement.paidAt || month >= monthKey(today) || compareIsoDates(statement.dueDate, today) >= 0) continue;
    const group = months.get(month) ?? [];
    group.push(statement);
    months.set(month, group);
    total = total.plus(statement.recordedTotal);
  }
  return { months, total };
}

export function monthComparison(current: PaymentMonthSummary | undefined, previous: PaymentMonthSummary | undefined) {
  if (!current || !previous || current.kind === "future" || previous.kind === "future"
    || current.statements.length === 0 || previous.statements.length === 0
    || current.hasOpenStatements || previous.hasOpenStatements || current.hasProjection || previous.hasProjection
    || !current.complete || !previous.complete
    || monthKey(addMonths(`${current.month}-01`, -1)) !== previous.month) {
    return { kind: "unavailable" as const };
  }
  return { kind: "comparable" as const, ...compareMonths(current.total, previous.total) };
}
