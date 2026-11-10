import {
  addDays,
  addMonths,
  clampDay,
  compareIsoDates,
  parseIsoDate,
  type IsoDate,
} from "./dates";

type CardStatementDays = {
  cutoffDay: number;
  paymentDay: number;
};

function assertStatementDay(day: number, label: "corte" | "pago") {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error(`Día de ${label} inválido`);
  }
}

export function cutoffDateForMonth(cutoffDay: number, year: number, month: number): IsoDate {
  assertStatementDay(cutoffDay, "corte");
  return clampDay(year, month, cutoffDay);
}

export function statementCutoffFor(cutoffDay: number, date: IsoDate): IsoDate {
  assertStatementDay(cutoffDay, "corte");

  const { year, month } = parseIsoDate(date);
  const currentMonthCutoff = cutoffDateForMonth(cutoffDay, year, month);

  if (compareIsoDates(date, currentMonthCutoff) <= 0) {
    return currentMonthCutoff;
  }

  return shiftStatement(cutoffDay, currentMonthCutoff, 1);
}

export function previousCutoff(cutoffDay: number, cutoffDate: IsoDate): IsoDate {
  return shiftStatement(cutoffDay, cutoffDate, -1);
}

export function periodStartFor(cutoffDay: number, cutoffDate: IsoDate): IsoDate {
  return addDays(previousCutoff(cutoffDay, cutoffDate), 1);
}

export function dueDateFor(paymentDay: number, cutoffDate: IsoDate): IsoDate {
  assertStatementDay(paymentDay, "pago");

  const { year, month } = parseIsoDate(cutoffDate);
  const currentMonthDueDate = clampDay(year, month, paymentDay);

  if (compareIsoDates(currentMonthDueDate, cutoffDate) > 0) {
    return currentMonthDueDate;
  }

  const { year: nextYear, month: nextMonth } = parseIsoDate(addMonths(cutoffDate, 1));
  return clampDay(nextYear, nextMonth, paymentDay);
}

export function shiftStatement(cutoffDay: number, cutoffDate: IsoDate, months: number): IsoDate {
  assertStatementDay(cutoffDay, "corte");

  const { year, month } = parseIsoDate(addMonths(cutoffDate, months));
  return cutoffDateForMonth(cutoffDay, year, month);
}

export function statementPeriod(card: CardStatementDays, date: IsoDate) {
  const cutoffDate = statementCutoffFor(card.cutoffDay, date);

  return {
    periodStart: periodStartFor(card.cutoffDay, cutoffDate),
    cutoffDate,
    dueDate: dueDateFor(card.paymentDay, cutoffDate),
  };
}
