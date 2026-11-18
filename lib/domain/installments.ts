import Decimal from "decimal.js";
import { compareIsoDates, type IsoDate } from "./dates";
import type { InterestMode } from "./interest";
import { type Currency, roundMoney, toCop } from "./money";
import { monthlyRateFromEA } from "./rates";
import { isStatementCutoff, shiftStatement, statementCutoffFor } from "./statements";

export type AmortizationMethod = "fixed_principal" | "french";
/** `cutoffDate` is null only for installments paid before tracking, which never belong to a statement (D31). */
export type InstallmentRow = { number: number; principal: Decimal; interest: Decimal; total: Decimal; balanceAfter: Decimal; cutoffDate: IsoDate | null; beforeTracking: boolean; principalCop: Decimal; interestCop: Decimal; totalCop: Decimal };
/** Copied from the last bank statement (D49): installment k already billed there and, optionally, the balance left after it. */
export type InProgressInput = { currentInstallment: number; balanceAfter?: Decimal | null; trackedFromCutoff: IsoDate };
type Input = { principal: Decimal; count: number; annualRateEa: Decimal; method: AmortizationMethod; interestFree: boolean; currency: Currency; fxRate?: Decimal; cutoffDay: number; purchaseDate: IsoDate; inProgress?: InProgressInput | null; interestMode?: InterestMode };
type ScheduleItem = { principal: Decimal; interest: Decimal; beforeTracking: boolean };

/** New purchases are limited to 36 installments (D15); effective plans of in-progress purchases, to 72 (D50). */
export const MAX_NEW_INSTALLMENTS = 36;
export const MAX_PLAN_INSTALLMENTS = 72;
const ZERO = new Decimal(0);
const sum = (values: Decimal[]) => values.reduce((total, value) => total.plus(value), ZERO);

function standardSchedule(input: Input, rate: Decimal): ScheduleItem[] {
  const payment = input.method === "french" && !rate.isZero() ? roundMoney(input.principal.times(rate).div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-input.count))), input.currency) : null;
  const regularPrincipal = roundMoney(input.principal.div(input.count), input.currency);
  let balance = new Decimal(input.principal);
  const items: ScheduleItem[] = [];
  for (let index = 1; index <= input.count; index += 1) {
    const interest = roundMoney(balance.times(rate), input.currency);
    const principal = index === input.count ? balance : payment ? payment.minus(interest) : regularPrincipal;
    balance = balance.minus(principal);
    if (principal.isNegative() || balance.isNegative()) throw new Error("El valor es muy pequeño para esa cantidad de cuotas.");
    items.push({ principal, interest, beforeTracking: false });
  }
  return items;
}

/** Fixed-principal remainder after a prepayment: same installment, fewer installments, last one for the rest (D31). */
function shortenedSchedule(balance: Decimal, installment: Decimal, rate: Decimal, currency: Currency): ScheduleItem[] {
  const items: ScheduleItem[] = [];
  let remaining = balance;
  while (remaining.gt(0)) {
    const interest = roundMoney(remaining.times(rate), currency);
    const principal = Decimal.min(installment, remaining);
    remaining = remaining.minus(principal);
    items.push({ principal, interest, beforeTracking: false });
  }
  return items;
}

/** Splits the principal paid before tracking evenly; the last prior installment absorbs the rounding. */
function priorSchedule(paid: Decimal, count: number, currency: Currency): ScheduleItem[] {
  const each = new Decimal(paid).div(count).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  return Array.from({ length: count }, (_, index) => ({
    principal: roundMoney(index === count - 1 ? paid.minus(each.times(count - 1)) : each, currency),
    interest: ZERO, beforeTracking: true,
  }));
}

/** R8: p = k − 1 installments paid before Al Corte; with the bank balance, c = P − balance − installment. */
function inProgressSchedule(input: Input, inProgress: InProgressInput, rate: Decimal, standard: ScheduleItem[]) {
  const k = inProgress.currentInstallment;
  const balanceAfter = inProgress.balanceAfter ?? null;
  if (input.count < 2 || !Number.isInteger(k) || k < 2 || (balanceAfter === null && k > input.count)) throw new Error("La cuota actual no es válida para esta compra.");
  if (!isStatementCutoff(input.cutoffDay, inProgress.trackedFromCutoff) || compareIsoDates(inProgress.trackedFromCutoff, statementCutoffFor(input.cutoffDay, input.purchaseDate)) < 0) {
    throw new Error("El corte de la cuota actual no es válido para esta tarjeta.");
  }
  const prior = k - 1;
  const installment = roundMoney(input.principal.div(input.count), input.currency);
  if (installment.isZero()) throw new Error("El valor es muy pequeño para esa cantidad de cuotas.");
  if (balanceAfter === null) {
    const paid = sum(standard.slice(0, prior).map((item) => item.principal));
    return { prior, paid, items: priorSchedule(paid, prior, input.currency).concat(standard.slice(prior)) };
  }
  if (input.method === "french") throw new Error("El saldo del banco solo se puede usar con tarjetas de capital fijo.");
  if (balanceAfter.isNegative()) throw new Error("El saldo pendiente no puede ser negativo.");
  const paid = input.principal.minus(balanceAfter).minus(installment);
  if (paid.isNegative()) throw new Error("El saldo pendiente no puede ser mayor que el valor menos una cuota.");
  // The plan's own rounding residual (absorbed by its last installment) plus one cent of bank rounding.
  const tolerance = input.principal.minus(installment.times(input.count)).abs().plus("0.01");
  if (k <= input.count && paid.minus(installment.times(prior)).abs().lte(tolerance)) {
    const planned = installment.times(prior);
    return { prior, paid: planned, items: priorSchedule(planned, prior, input.currency).concat(standard.slice(prior)) };
  }
  const remaining = input.principal.minus(paid);
  if (prior + remaining.div(installment).ceil().toNumber() > MAX_PLAN_INSTALLMENTS) throw new Error(`El plan no puede superar ${MAX_PLAN_INSTALLMENTS} cuotas. Revisa la cuota y el saldo.`);
  return { prior, paid, items: priorSchedule(paid, prior, input.currency).concat(shortenedSchedule(remaining, installment, rate, input.currency)) };
}

export function buildInstallmentPlan(input: Input) {
  if (!input.principal.gt(0)) throw new Error("El capital debe ser mayor que cero");
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > MAX_NEW_INSTALLMENTS) throw new Error("Número de cuotas inválido");
  if (input.annualRateEa.lt(0)) throw new Error("La tasa no puede ser negativa");
  if (input.currency === "USD" && (!input.fxRate || !input.fxRate.gt(0))) throw new Error("La TRM es obligatoria para USD");
  if (input.currency === "COP" && input.fxRate) throw new Error("La TRM no aplica para COP");
  // On-balance cards bill interest once per statement (D32): their installments are principal only.
  const rate = input.count === 1 || input.interestFree || input.interestMode === "on_balance" ? new Decimal(0) : monthlyRateFromEA(input.annualRateEa);
  const amountCop = toCop(input.principal, input.currency, input.fxRate);
  const standard = standardSchedule(input, rate);
  const progress = input.inProgress ? inProgressSchedule(input, input.inProgress, rate, standard) : { prior: 0, paid: ZERO, items: standard };
  const firstCutoff = input.inProgress?.trackedFromCutoff ?? statementCutoffFor(input.cutoffDay, input.purchaseDate);
  let balance = new Decimal(input.principal); let principalCopSoFar = new Decimal(0);
  const rows: InstallmentRow[] = progress.items.map((item, index) => {
    const number = index + 1;
    const { principal, interest } = item;
    balance = balance.minus(principal);
    const principalCop = input.currency === "COP" ? principal : number === progress.items.length ? amountCop.minus(principalCopSoFar) : roundMoney(principal.times(input.fxRate!), "COP");
    principalCopSoFar = principalCopSoFar.plus(principalCop);
    const interestCop = input.currency === "COP" ? interest : roundMoney(interest.times(input.fxRate!), "COP");
    const cutoffDate = item.beforeTracking ? null : shiftStatement(input.cutoffDay, firstCutoff, number - 1 - progress.prior);
    return { number, principal, interest, total: principal.plus(interest), balanceAfter: balance, cutoffDate, beforeTracking: item.beforeTracking, principalCop, interestCop, totalCop: principalCop.plus(interestCop) };
  });
  return {
    monthlyRate: rate, rows, amountCop,
    totalInterest: sum(rows.map((row) => row.interest)), totalInterestCop: sum(rows.map((row) => row.interestCop)),
    firstInstallment: rows[progress.prior]!,
    priorInstallments: progress.prior, priorPrincipalPaid: progress.paid,
    /** Original N when the effective plan differs (D31); null otherwise. */
    originalCount: rows.length === input.count ? null : input.count,
  };
}

/** Paid before tracking, or billed in a statement already closed (R7). Only rows paid before tracking lack a cutoff date. */
export function isInstallmentCompleted(row: Pick<InstallmentRow, "beforeTracking" | "cutoffDate">, today: IsoDate): boolean {
  return row.beforeTracking || row.cutoffDate! < today;
}

/** Installments paid before tracking count as completed; progress is measured on the effective plan. */
export function installmentProgress(rows: InstallmentRow[], today: IsoDate) {
  const completed = rows.filter((row) => isInstallmentCompleted(row, today)).length;
  return { current: Math.min(completed + 1, rows.length), count: rows.length, pendingPrincipal: sum(rows.filter((row) => !isInstallmentCompleted(row, today)).map((row) => row.principal)) };
}
