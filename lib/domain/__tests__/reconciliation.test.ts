import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { buildInstallmentPlan, type AmortizationMethod } from "@/lib/domain/installments";
import type { Currency } from "@/lib/domain/money";
import { applyPrepayment, type PaymentTarget } from "@/lib/domain/payments";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import {
  balanceAfterStatement, bankInterest, buildBalanceCorrection, closeComparison, effectiveAnnualRate, planBalanceCorrections, statementReconciledAt, statementsToReview,
} from "@/lib/domain/reconciliation";
import { statementCutoffFor } from "@/lib/domain/statements";

const d = (value: string | number) => new Decimal(value);
const total = (values: Decimal[]) => values.reduce((sum, value) => sum.plus(value), d(0));

function target(options: { amount: string; count: number; date: string; currency?: Currency; fxRate?: string; rateEa?: string; method?: AmortizationMethod; perInstallment?: boolean }): PaymentTarget {
  const currency = options.currency ?? "COP";
  const fxRate = options.fxRate ? d(options.fxRate) : null;
  const plan = buildInstallmentPlan({
    principal: d(options.amount), count: options.count, annualRateEa: d(options.rateEa ?? "0"), method: options.method ?? "fixed_principal", interestFree: false,
    currency, fxRate: fxRate ?? undefined, cutoffDay: 15, purchaseDate: options.date, interestMode: options.perInstallment ? "per_installment" : "on_balance",
  });
  return {
    id: "compra", type: "purchase", date: options.date, currency, installmentsCount: options.count, interestFree: false, isInternational: false,
    statementCutoff: statementCutoffFor(15, options.date),
    terms: { amount: d(options.amount), amountCop: plan.amountCop, currency, fxRate, method: options.method ?? "fixed_principal", monthlyRate: plan.monthlyRate },
    rows: plan.rows, prepayments: [],
  };
}

describe("tasa vigente (D39)", () => {
  it("convierte M.V. a E.A. y vuelve a la tasa del banco con 4 decimales", () => {
    const annual = effectiveAnnualRate(d("0.021003"), "mv");
    expect(annual.decimalPlaces()).toBeLessThanOrEqual(6);
    expect(annual.toString()).toBe("0.283288");
    expect(monthlyRateFromEA(annual).times(100).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toString()).toBe("2.1003");
    expect(effectiveAnnualRate(d("0.28991234"), "ea").toString()).toBe("0.289912");
  });
});

describe("comparación con el banco (F15)", () => {
  it("oculta diferencias dentro del redondeo y muestra las demás", () => {
    const rows = closeComparison({ minimum: d("1178835.57"), debt: d("3845774.86"), interest: d("20368") },
      { minimum: d("1178836"), debt: d("3850000"), interest: null });
    expect(rows.map((row) => [row.concept, row.difference?.toString() ?? null])).toEqual([["minimum", null], ["debt", "4225.14"], ["interest", null]]);
    expect(rows[2]!.bank).toBeNull();
  });

  it("suma intereses corrientes y de mora", () => {
    expect(bankInterest(null, null)).toBeNull();
    expect(bankInterest(d("20000"), null)!.toString()).toBe("20000");
    expect(bankInterest(null, d("1500"))!.toString()).toBe("1500");
    expect(bankInterest(d("20000"), d("1500"))!.toString()).toBe("21500");
  });
});

describe("saldo por compra (D39, D31)", () => {
  // Avance de $600.000 a 24 cuotas de $25.000 del 16 de abril: 7 cuotas facturadas al corte del 15 de noviembre.
  const advance = target({ amount: "600000", count: 24, date: "2026-04-16" });

  it("calcula el saldo después del extracto con los abonos vigentes a esa fecha", () => {
    expect(balanceAfterStatement(advance, "2026-11-15").toString()).toBe("425000");
    const withPrepayments = { ...advance, prepayments: [{ amount: d("1000"), amountCop: d("1000"), date: "2026-11-10" }, { amount: d("2000"), amountCop: d("2000"), date: "2026-11-20" }, { amount: d("500"), amountCop: d("500") }] };
    expect(balanceAfterStatement(withPrepayments, "2026-11-15").toString()).toBe("423500");
  });

  it("sin diferencia no corrige nada", () => {
    expect(buildBalanceCorrection({ target: advance, statementCutoff: "2026-11-15", bankBalance: d("425000"), cutoffDay: 15 })).toBeNull();
    // The bank rounds each balance up to the next peso (R8).
    expect(buildBalanceCorrection({ target: advance, statementCutoff: "2026-11-15", bankBalance: d("425001"), cutoffDay: 15 })).toBeNull();
    expect(buildBalanceCorrection({ target: advance, statementCutoff: "2026-11-15", bankBalance: d("424999.99"), cutoffDay: 15 })?.amount.toString()).toBe("0.01");
  });

  it("un saldo del banco menor deja la misma cuota y menos cuotas, solo en esa compra", () => {
    const correction = buildBalanceCorrection({ target: advance, statementCutoff: "2026-11-15", bankBalance: d("269998.46"), cutoffDay: 15 })!;
    expect([correction.calculated.toString(), correction.amount.toString(), correction.amountCop.toString(), correction.replacedFromNumber]).toEqual(["425000", "155001.54", "155001.54", 8]);
    expect(correction.rows.length).toBe(11);
    expect(correction.rows.at(-1)).toMatchObject({ number: 18, cutoffDate: "2027-10-15" });
    expect(correction.rows.at(-1)!.principal.toString()).toBe("19998.46");
    expect(total([...advance.rows.slice(0, 7).map((row) => row.principal), correction.amount, ...correction.rows.map((row) => row.principal)]).toString()).toBe("600000");
  });

  it("un saldo del banco mayor alarga el plan con la misma cuota en los extractos siguientes", () => {
    const fridge = target({ amount: "600000", count: 6, date: "2026-10-10" });
    const correction = buildBalanceCorrection({ target: fridge, statementCutoff: "2026-11-15", bankBalance: d("450000"), cutoffDay: 15 })!;
    expect(correction.amount.toString()).toBe("-50000");
    expect(correction.rows.map((row) => [row.number, row.principal.toString(), row.cutoffDate])).toEqual([
      [3, "100000", "2026-12-15"], [4, "100000", "2027-01-15"], [5, "100000", "2027-02-15"], [6, "100000", "2027-03-15"], [7, "50000", "2027-04-15"],
    ]);
  });

  it("si ya se facturó todo, el saldo del banco sigue con la última cuota", () => {
    const short = target({ amount: "300000", count: 3, date: "2026-08-10" });
    const correction = buildBalanceCorrection({ target: short, statementCutoff: "2026-10-15", bankBalance: d("150000"), cutoffDay: 15 })!;
    expect(correction.replacedFromNumber).toBe(4);
    expect(correction.rows.map((row) => [row.number, row.principal.toString(), row.cutoffDate])).toEqual([[4, "100000", "2026-11-15"], [5, "50000", "2026-12-15"]]);
  });

  it("los abonos posteriores al corte siguen aplicando sobre el saldo del banco", () => {
    const prepaid = applyPrepayment({ target: advance, amount: d("100000"), date: "2026-11-19", effect: "reduce_term" });
    const after = { ...advance, rows: [...advance.rows.slice(0, 7), ...prepaid.rows!], prepayments: [{ amount: d("100000"), amountCop: prepaid.amountCop, date: "2026-11-19" }] };
    // El banco imprime el saldo al corte, antes del abono.
    expect(buildBalanceCorrection({ target: after, statementCutoff: "2026-11-15", bankBalance: d("425000"), cutoffDay: 15 })).toBeNull();
    const correction = buildBalanceCorrection({ target: after, statementCutoff: "2026-11-15", bankBalance: d("400000"), cutoffDay: 15 })!;
    expect(correction.amount.toString()).toBe("25000");
    expect(total(correction.rows.map((row) => row.principal)).toString()).toBe("300000");
    expect(() => buildBalanceCorrection({ target: after, statementCutoff: "2026-11-15", bankBalance: d("50000"), cutoffDay: 15 })).toThrow("abonos registrados después del corte");
  });

  it("no deja pasar el plan de 72 cuotas", () => {
    expect(() => buildBalanceCorrection({ target: advance, statementCutoff: "2026-11-15", bankBalance: d("2000000"), cutoffDay: 15 })).toThrow("72 cuotas");
  });

  it("con intereses por cuota, la nueva cuota paga interés sobre el saldo del banco", () => {
    const purchase = target({ amount: "1200000", count: 12, date: "2026-10-10", rateEa: "0.28", perInstallment: true });
    const correction = buildBalanceCorrection({ target: purchase, statementCutoff: "2026-11-15", bankBalance: d("900000"), cutoffDay: 15 })!;
    expect(correction.rows[0]!.interest.toString()).toBe(d("900000").times(monthlyRateFromEA(d("0.28"))).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
  });

  it("en dólares el equivalente COP cuadra, también al liquidar", () => {
    const usd = target({ amount: "120", count: 12, date: "2026-10-12", currency: "USD", fxRate: "4000" });
    const correction = buildBalanceCorrection({ target: usd, statementCutoff: "2026-11-15", bankBalance: d("95"), cutoffDay: 15 })!;
    expect(correction.amountCop.toString()).toBe("20000");
    expect(total([...usd.rows.slice(0, 2).map((row) => row.principalCop), correction.amountCop, ...correction.rows.map((row) => row.principalCop)]).toString()).toBe("480000");
    const settled = buildBalanceCorrection({ target: usd, statementCutoff: "2026-11-15", bankBalance: d(0), cutoffDay: 15 })!;
    expect([settled.rows.length, settled.amount.toString(), settled.amountCop.toString()]).toEqual([0, "100", "400000"]);
  });
});

describe("correcciones del cierre (D39)", () => {
  it("corrige los saldos ingresados, quita los vaciados o iguales e ignora los no enviados", () => {
    const base = target({ amount: "600000", count: 6, date: "2026-10-10" });
    const purchases = [
      { id: "corregida", target: base, bankBalance: null },
      { id: "vaciada", target: base, bankBalance: d("350000") },
      { id: "igual", target: base, bankBalance: d("350000") },
      { id: "igual-nueva", target: base, bankBalance: null },
      { id: "sin-enviar", target: base, bankBalance: d("350000") },
    ];
    const entered = new Map([["corregida", d("350000")], ["vaciada", null], ["igual", d("400000")], ["igual-nueva", d("400000")]]);
    const { corrections, remove } = planBalanceCorrections({ purchases, entered, statementCutoff: "2026-11-15", cutoffDay: 15 });
    expect(remove).toEqual(["vaciada", "igual"]);
    expect(corrections).toEqual([expect.objectContaining({ transaction_id: "corregida", bank_balance: "350000", amount: "50000", amount_cop: "50000", replaced_from_number: 3 })]);
    expect((corrections[0]!.installments as Array<{ principal: string; cutoff_date: string }>).map((row) => [row.principal, row.cutoff_date])).toEqual([
      ["100000", "2026-12-15"], ["100000", "2027-01-15"], ["100000", "2027-02-15"], ["50000", "2027-03-15"],
    ]);
  });
});

describe("extractos por cerrar (F15)", () => {
  it("se concilia cuando todas las monedas con cargos lo están", () => {
    expect(statementReconciledAt({ COP: "2026-11-20T10:00:00Z", USD: null }, ["COP", "USD"])).toBeNull();
    expect(statementReconciledAt({ COP: "2026-11-20T10:00:00Z" }, ["COP"])).toBe("2026-11-20T10:00:00Z");
  });

  it("avisa solo del último extracto cortado de cada tarjeta activa sin conciliar", () => {
    const cards = [{ id: "visa", archived: false }, { id: "master", archived: false }, { id: "vieja", archived: true }, { id: "nueva", archived: false }];
    const statements = [
      { id: "visa-oct", cardId: "visa", cutoffDate: "2026-10-15", reconciledAt: null },
      { id: "visa-nov", cardId: "visa", cutoffDate: "2026-11-15", reconciledAt: null },
      { id: "visa-dic", cardId: "visa", cutoffDate: "2026-12-15", reconciledAt: null },
      { id: "master-nov", cardId: "master", cutoffDate: "2026-11-15", reconciledAt: "2026-11-20T10:00:00Z" },
      { id: "master-oct", cardId: "master", cutoffDate: "2026-10-15", reconciledAt: null },
      { id: "vieja-nov", cardId: "vieja", cutoffDate: "2026-11-15", reconciledAt: null },
    ];
    expect(statementsToReview(cards, statements, "2026-11-21").map((statement) => statement.id)).toEqual(["visa-nov"]);
  });
});
