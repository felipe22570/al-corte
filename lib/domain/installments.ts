import Decimal from "decimal.js";
import { type IsoDate } from "./dates";
import { type Currency, roundMoney, toCop } from "./money";
import { monthlyRateFromEA } from "./rates";
import { shiftStatement, statementCutoffFor } from "./statements";

export type AmortizationMethod = "fixed_principal" | "french";
export type InstallmentRow = { number: number; principal: Decimal; interest: Decimal; total: Decimal; balanceAfter: Decimal; cutoffDate: IsoDate; principalCop: Decimal; interestCop: Decimal; totalCop: Decimal };
type Input = { principal: Decimal; count: number; annualRateEa: Decimal; method: AmortizationMethod; interestFree: boolean; currency: Currency; fxRate?: Decimal; cutoffDay: number; purchaseDate: IsoDate };

export function buildInstallmentPlan(input: Input) {
  if (!input.principal.gt(0)) throw new Error("El capital debe ser mayor que cero");
  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 36) throw new Error("Número de cuotas inválido");
  if (input.annualRateEa.lt(0)) throw new Error("La tasa no puede ser negativa");
  if (input.currency === "USD" && (!input.fxRate || !input.fxRate.gt(0))) throw new Error("La TRM es obligatoria para USD");
  if (input.currency === "COP" && input.fxRate) throw new Error("La TRM no aplica para COP");
  const rate = input.count === 1 || input.interestFree ? new Decimal(0) : monthlyRateFromEA(input.annualRateEa);
  const amountCop = toCop(input.principal, input.currency, input.fxRate);
  const firstCutoff = statementCutoffFor(input.cutoffDay, input.purchaseDate);
  const payment = input.method === "french" && !rate.isZero() ? roundMoney(input.principal.times(rate).div(new Decimal(1).minus(new Decimal(1).plus(rate).pow(-input.count))), input.currency) : null;
  const regularPrincipal = roundMoney(input.principal.div(input.count), input.currency);
  let balance = new Decimal(input.principal); let principalCopSoFar = new Decimal(0);
  const rows: InstallmentRow[] = [];
  for (let index = 1; index <= input.count; index += 1) {
    const interest = roundMoney(balance.times(rate), input.currency);
    const principal = index === input.count ? balance : input.method === "french" && payment ? payment.minus(interest) : regularPrincipal;
    const total = principal.plus(interest); balance = balance.minus(principal);
    const principalCop = input.currency === "COP" ? principal : index === input.count ? amountCop.minus(principalCopSoFar) : roundMoney(principal.times(input.fxRate!), "COP");
    principalCopSoFar = principalCopSoFar.plus(principalCop);
    const interestCop = input.currency === "COP" ? interest : roundMoney(interest.times(input.fxRate!), "COP");
    rows.push({ number: index, principal, interest, total, balanceAfter: balance, cutoffDate: shiftStatement(input.cutoffDay, firstCutoff, index - 1), principalCop, interestCop, totalCop: principalCop.plus(interestCop) });
  }
  const totalInterest = rows.reduce((sum, row) => sum.plus(row.interest), new Decimal(0));
  const totalInterestCop = rows.reduce((sum, row) => sum.plus(row.interestCop), new Decimal(0));
  return { monthlyRate: rate, rows, amountCop, totalInterest, totalInterestCop, firstInstallment: rows[0]! };
}

export function installmentProgress(rows: InstallmentRow[], today: IsoDate) {
  const completed = rows.filter((row) => row.cutoffDate < today).length;
  return { current: Math.min(completed + 1, rows.length), count: rows.length, pendingPrincipal: rows.slice(completed).reduce((sum, row) => sum.plus(row.principal), new Decimal(0)) };
}
