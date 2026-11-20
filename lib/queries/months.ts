import {
  availablePaymentMonths,
  buildMonths,
  isWithinMonthProjectionWindow,
  overdueStatements,
  parsePaymentMonth,
  paymentMonth,
  previousPaymentMonth,
  projectStatements,
  selectMonthStatementScope,
  type ProjectionInput,
} from "@/lib/domain/months";
import type { IsoDate } from "@/lib/domain/dates";

type Card = ProjectionInput["cards"][number];
type Statement = ProjectionInput["statements"][number];
type Movement = ProjectionInput["movements"][number];
type Installment = ProjectionInput["installments"][number];
type Subscription = ProjectionInput["subscriptions"][number] & { name?: string };

export type MonthReadSource = {
  loadCards(): Promise<Card[]>;
  loadStatements(): Promise<Statement[]>;
  loadSubscriptions(): Promise<Subscription[]>;
  loadFxRate(): Promise<ProjectionInput["fxRate"]>;
  loadCharges(statementIds: string[]): Promise<{ movements: Movement[]; installments: Installment[]; prepaymentBases?: ProjectionInput["prepaymentBases"] }>;
  loadSubscriptionMovements(today: IsoDate): Promise<Movement[]>;
};

export async function loadMonthDetail(source: MonthReadSource, today: IsoDate, requested: string) {
  const target = parsePaymentMonth(requested);
  if (!target) return null;
  const previousMonth = previousPaymentMonth(target);
  const current = paymentMonth(today);
  const [cards, statements, subscriptions, fxRate, subscriptionMovements] = await Promise.all([
    source.loadCards(), source.loadStatements(), source.loadSubscriptions(), source.loadFxRate(),
    source.loadSubscriptionMovements(today),
  ]);
  const chargeIds = statements.filter((statement) => {
    const month = paymentMonth(statement.dueDate);
    return month === target || month === previousMonth || (target === current && !statement.paidAt && statement.dueDate < today && month < current);
  }).map((statement) => statement.id);
  const charges = await source.loadCharges(chargeIds);
  const movements = [...new Map([...charges.movements, ...subscriptionMovements].map((movement) => [movement.id, movement])).values()];
  const projected = projectStatements({ cards, statements, movements, installments: charges.installments, prepaymentBases: charges.prepaymentBases, subscriptions, fxRate, today });
  const summaries = buildMonths(projected.statements, today);
  const available = availablePaymentMonths(today, statements.map((statement) => statement.dueDate), summaries.filter((month) => month.kind === "future").map((month) => month.month));
  const index = available.indexOf(target);
  if (index < 0) return null;
  const month = summaries.find((summary) => summary.month === target);
  if (!month) return null;
  return {
    month,
    previous: summaries.find((summary) => summary.month === previousMonth && summary.statements.length > 0),
    neighbors: { previous: available[index - 1] ?? null, next: available[index + 1] ?? null },
    overdue: overdueStatements(projected.statements, today),
    subscriptionNames: Object.fromEntries(subscriptions.map((subscription) => [subscription.id, subscription.name ?? "Suscripción"])),
  };
}

export async function loadMonthOverview(
  source: MonthReadSource,
  today: IsoDate,
  options: { historySize?: number; before?: string } = {},
) {
  const [cards, statements, subscriptions, fxRate, subscriptionMovements] = await Promise.all([
    source.loadCards(), source.loadStatements(), source.loadSubscriptions(), source.loadFxRate(),
    source.loadSubscriptionMovements(today),
  ]);
  const scope = selectMonthStatementScope(statements, today, options.historySize ?? 12, options.before);
  const chargeIds = scope.statements.filter((statement) => isWithinMonthProjectionWindow(statement.dueDate, today))
    .map((statement) => statement.id);
  const charges = await source.loadCharges(chargeIds);
  const movements = [...new Map([...charges.movements, ...subscriptionMovements].map((movement) => [movement.id, movement])).values()];
  const projected = projectStatements({ cards, statements: scope.statements, movements, installments: charges.installments, prepaymentBases: charges.prepaymentBases, subscriptions, fxRate, today });
  const months = buildMonths(projected.statements, today);
  const current = months.find((month) => month.kind === "current");
  if (!current) throw new Error("No pudimos calcular el mes actual.");
  const historyByMonth = new Map(months.map((month) => [month.month, month]));
  const history = scope.history.months.flatMap((month) => {
    const summary = historyByMonth.get(month);
    return summary ? [summary] : [];
  });
  return {
    current,
    future: months.filter((month) => month.kind === "future"),
    history,
    historyNextBefore: scope.history.nextBefore,
    overdue: overdueStatements(projected.statements, today),
    hasLaterCommitments: projected.hasLaterCommitments,
    subscriptionNames: Object.fromEntries(subscriptions.map((subscription) => [subscription.id, subscription.name ?? "Suscripción"])),
  };
}
