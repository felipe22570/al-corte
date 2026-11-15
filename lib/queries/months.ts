import {
  buildMonths,
  isWithinMonthProjectionWindow,
  overdueStatements,
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
  loadCharges(statementIds: string[]): Promise<{ movements: Movement[]; installments: Installment[] }>;
  loadSubscriptionMovements(today: IsoDate): Promise<Movement[]>;
};

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
  const projected = projectStatements({ cards, statements: scope.statements, movements, installments: charges.installments, subscriptions, fxRate, today });
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
