import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { buildInstallmentPlan, type AmortizationMethod } from "@/lib/domain/installments";
import { estimateBalanceInterest } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import {
  applyPrepayment, bancolombiaLevel, buildPaymentPlan, paymentDateError, paymentPayload, pendingAt, pendingMinimum, prepaymentInterestWeight,
  proposeAllocation, reduceTermSchedule, resolveAllocation, roundUpToUnit, splitPayment, toCandidate, type PaymentTarget, type PrepaymentTargetType,
} from "@/lib/domain/payments";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import { statementCutoffFor } from "@/lib/domain/statements";

const d = (value: string | number) => new Decimal(value);
const total = (values: Decimal[]) => values.reduce((sum, value) => sum.plus(value), d(0));

type TargetOptions = {
  amount: string; count: number; date: string; type?: PrepaymentTargetType; currency?: Currency; fxRate?: string; rateEa?: string;
  method?: AmortizationMethod; perInstallment?: boolean; interestFree?: boolean; isInternational?: boolean;
};

/** Builds a movement as Al Corte stores it: plan rows by R2, cutoff day 15. */
function target(id: string, options: TargetOptions): PaymentTarget {
  const currency = options.currency ?? "COP";
  const fxRate = options.fxRate ? d(options.fxRate) : null;
  const plan = buildInstallmentPlan({
    principal: d(options.amount), count: options.count, annualRateEa: d(options.rateEa ?? "0"), method: options.method ?? "fixed_principal",
    interestFree: options.interestFree ?? false, currency, fxRate: fxRate ?? undefined, cutoffDay: 15, purchaseDate: options.date,
    interestMode: options.perInstallment ? "per_installment" : "on_balance",
  });
  return {
    id, type: options.type ?? "purchase", date: options.date, currency, installmentsCount: options.count, interestFree: options.interestFree ?? false,
    isInternational: options.isInternational ?? false, statementCutoff: statementCutoffFor(15, options.date),
    terms: { amount: d(options.amount), amountCop: plan.amountCop, currency, fxRate, method: options.method ?? "fixed_principal", monthlyRate: plan.monthlyRate },
    rows: options.count > 1 ? plan.rows : [], prepayments: [],
  };
}

describe("pago mínimo pendiente y reparto del pago (D37)", () => {
  it("usa el mínimo del banco si está registrado y descuenta los pagos ya hechos al extracto", () => {
    expect(pendingMinimum({ calculated: d("1178835.57"), bankMinimum: null, paid: d(0) }).toString()).toBe("1178835.57");
    expect(pendingMinimum({ calculated: d("1178835.57"), bankMinimum: d("1178836"), paid: d("1000000") }).toString()).toBe("178836");
    expect(pendingMinimum({ calculated: d("100"), bankMinimum: null, paid: d("150") }).toString()).toBe("0");
  });

  it("redondea hacia arriba al peso o al dólar, como el banco", () => {
    expect(roundUpToUnit(d("1178835.57")).toString()).toBe("1178836");
    expect(roundUpToUnit(d("8.22")).toString()).toBe("9");
    expect(roundUpToUnit(d("100")).toString()).toBe("100");
  });

  it("cubre primero el mínimo; el excedente es abono solo si supera el redondeo del banco", () => {
    expect(splitPayment(d("1178836"), d("1178835.57"))).toEqual({ toMinimum: d("1178835.57"), coversMinimum: true, prepayable: d(0) });
    const partial = splitPayment(d("500000"), d("1178835.57"));
    expect([partial.toMinimum.toString(), partial.coversMinimum, partial.prepayable.toString()]).toEqual(["500000", false, "0"]);
    expect(splitPayment(d("1500000"), d("1178835.57")).prepayable.toString()).toBe("321164.43");
  });
});

describe("prioridad de abonos de Bancolombia (R9, D38)", () => {
  const cop = [
    target("cero", { amount: "1200000", count: 12, date: "2026-03-10", interestFree: true }),
    target("avance", { amount: "1200000", count: 12, date: "2026-04-10", type: "cash_advance" }),
    target("internacional", { amount: "1200000", count: 12, date: "2026-05-10", isInternational: true }),
    target("nacional", { amount: "1200000", count: 12, date: "2026-06-10" }),
    target("una-cuota", { amount: "50000", count: 1, date: "2026-11-20" }),
  ];

  it("en pesos reparte: una cuota sin facturar, cuotas nacionales, internacionales, avances y tasa 0 %", () => {
    const candidates = cop.map((item) => toCandidate(item, "2026-11-30"));
    expect(proposeAllocation(d("5000000"), candidates, "bancolombia_priority").allocations.map((item) => item.transactionId))
      .toEqual(["una-cuota", "nacional", "internacional", "avance", "cero"]);
    const partial = proposeAllocation(d("80000"), candidates, "bancolombia_priority");
    expect(partial.allocations.map((item) => [item.transactionId, item.amount.toString()])).toEqual([["una-cuota", "50000"], ["nacional", "30000"]]);
    expect(partial.unallocated.toString()).toBe("0");
  });

  it("clasifica comisiones, ajustes y avances internacionales según la tabla publicada", () => {
    const base = { currency: "COP" as const, installmentsCount: 1, interestFree: false, isInternational: false };
    expect(bancolombiaLevel({ ...base, type: "advance_fee" })).toBe(2);
    expect(bancolombiaLevel({ ...base, type: "adjustment" })).toBe(6);
    expect(bancolombiaLevel({ ...base, type: "cash_advance", isInternational: true })).toBe(14);
    expect(bancolombiaLevel({ ...base, type: "purchase", isInternational: true })).toBe(12);
    expect(bancolombiaLevel({ ...base, type: "purchase", interestFree: true })).toBe(5);
  });

  it("en dólares reparte: cuotas diferidas, avances y compras al 0 %", () => {
    const usd = [
      target("cero", { amount: "120", count: 12, date: "2026-03-10", currency: "USD", fxRate: "4000", interestFree: true }),
      target("avance", { amount: "120", count: 12, date: "2026-04-10", currency: "USD", fxRate: "4000", type: "cash_advance" }),
      target("diferida", { amount: "30", count: 36, date: "2026-05-10", currency: "USD", fxRate: "4000" }),
    ].map((item) => toCandidate(item, "2026-11-30"));
    expect(proposeAllocation(d("1000"), usd, "bancolombia_priority").allocations.map((item) => item.transactionId)).toEqual(["diferida", "avance", "cero"]);
    const base = { currency: "USD" as const, installmentsCount: 1, interestFree: false, isInternational: true };
    expect([bancolombiaLevel({ ...base, type: "advance_fee" }), bancolombiaLevel({ ...base, type: "adjustment" })]).toEqual([2, 6]);
  });

  it("dentro de un mismo nivel abona primero la más antigua y lo marca como supuesto", () => {
    const candidates = [
      target("nueva", { amount: "1200000", count: 12, date: "2026-08-10" }),
      target("antigua", { amount: "1200000", count: 12, date: "2026-07-10" }),
      target("una-cuota", { amount: "50000", count: 1, date: "2026-11-20" }),
    ].map((item) => toCandidate(item, "2026-11-30"));
    const { allocations } = proposeAllocation(d("400000"), candidates, "bancolombia_priority");
    expect(allocations.map((item) => [item.transactionId, item.amount.toString(), item.assumed])).toEqual([
      ["una-cuota", "50000", false], ["antigua", "350000", true],
    ]);
    // When the level is fully covered, the order inside it does not matter.
    expect(proposeAllocation(d("2000000"), candidates, "bancolombia_priority").allocations.every((item) => !item.assumed)).toBe(true);
  });

  it("con la más antigua primero ignora los niveles y con abono dirigido no propone nada", () => {
    const candidates = cop.map((item) => toCandidate(item, "2026-11-30"));
    const oldest = proposeAllocation(d("5000000"), candidates, "oldest_first");
    expect(oldest.allocations.map((item) => item.transactionId)).toEqual(["cero", "avance", "internacional", "nacional", "una-cuota"]);
    expect(oldest.allocations.every((item) => !item.assumed)).toBe(true);
    expect(proposeAllocation(d("100000"), candidates, "directed")).toEqual({ allocations: [], unallocated: d("100000") });
    const sameDay = ["b", "a"].map((id) => toCandidate(target(id, { amount: "1200000", count: 12, date: "2026-07-10" }), "2026-11-30"));
    expect(proposeAllocation(d("100000"), sameDay, "oldest_first").allocations.map((item) => item.transactionId)).toEqual(["a"]);
  });
});

describe("distribución editada por el dueño (D38)", () => {
  const candidates = [
    target("a", { amount: "1200000", count: 12, date: "2026-07-10" }),
    target("b", { amount: "1200000", count: 12, date: "2026-08-10" }),
  ].map((item) => toCandidate(item, "2026-11-30"));
  const proposal = proposeAllocation(d("400000"), candidates, "bancolombia_priority").allocations;

  it("conserva el supuesto si se acepta la propuesta y lo quita si se cambia", () => {
    expect(resolveAllocation(d("400000"), candidates, proposal, proposal).every((item) => item.assumed)).toBe(true);
    const edited = resolveAllocation(d("400000"), candidates, [{ transactionId: "b", amount: d("400000") }], proposal);
    expect(edited).toEqual([{ transactionId: "b", amount: d("400000"), assumed: false }]);
  });

  it("rechaza compras ajenas, repetidas, montos inválidos o una suma distinta", () => {
    expect(() => resolveAllocation(d("400000"), candidates, [{ transactionId: "x", amount: d("400000") }], proposal)).toThrow("no admite abonos");
    expect(() => resolveAllocation(d("400000"), candidates, [{ transactionId: "a", amount: d("200000") }, { transactionId: "a", amount: d("200000") }], proposal)).toThrow("no admite abonos");
    expect(() => resolveAllocation(d("400000"), candidates, [{ transactionId: "a", amount: d("0") }], proposal)).toThrow("mayor que cero");
    expect(() => resolveAllocation(d("400000"), candidates, [{ transactionId: "a", amount: d("0.001") }], proposal)).toThrow("mayor que cero");
    expect(() => resolveAllocation(d("800000"), candidates, [{ transactionId: "a", amount: d("800000") }], proposal)).toThrow("mayor que cero");
    expect(() => resolveAllocation(d("400000"), candidates, [{ transactionId: "a", amount: d("300000") }], proposal)).toThrow("no suma");
  });

  it("si el abono supera todos los saldos, basta con cubrirlos (saldo a favor)", () => {
    const all = candidates.map((item) => ({ transactionId: item.id, amount: item.pending }));
    expect(resolveAllocation(d("2000000"), candidates, all, []).map((item) => item.amount.toString())).toEqual(["700000", "800000"]);
  });
});

describe("efecto del abono en la compra (R9)", () => {
  // Avance de la Mastercard del 16 de abril: $600.000 a 24 cuotas de $25.000, solo capital (sobre saldo).
  const advance = target("avance", { amount: "600000", count: 24, date: "2026-04-16", type: "cash_advance" });

  it("reducir plazo: el abono que deja $269.998,46 da 18 cuotas efectivas, como el extracto real", () => {
    expect(pendingAt(advance, "2026-11-30").toString()).toBe("425000");
    const result = applyPrepayment({ target: advance, amount: d("155001.54"), date: "2026-11-30", effect: "reduce_term" });
    expect(result.replacedFromNumber).toBe(8);
    expect(result.rows!.length).toBe(11);
    expect(result.rows!.at(-1)).toMatchObject({ number: 18, cutoffDate: "2027-10-15" });
    expect(result.rows!.slice(0, 10).every((row) => row.principal.equals(25000))).toBe(true);
    expect(result.rows!.at(-1)!.principal.toString()).toBe("19998.46");
    expect(result.rows![0]!.balanceAfter.toString()).toBe("244998.46");
    expect(result.amountCop.toString()).toBe("155001.54");
  });

  it("reducir cuota: mismo número de cuotas y nueva cuota = saldo ÷ cuotas restantes", () => {
    const result = applyPrepayment({ target: advance, amount: d("155001.54"), date: "2026-11-30", effect: "reduce_installment" });
    expect(result.rows!.length).toBe(17);
    expect(result.rows!.at(-1)).toMatchObject({ number: 24, cutoffDate: "2028-04-15" });
    expect(result.rows![0]!.principal.toString()).toBe("15882.26");
    expect(result.rows!.at(-1)!.principal.toString()).toBe("15882.3");
    expect(total(result.rows!.map((row) => row.principal)).toString()).toBe("269998.46");
  });

  it("con intereses por cuota, la cuota nueva paga interés sobre el saldo reducido", () => {
    const purchase = target("compra", { amount: "1000000", count: 3, date: "2026-01-20", rateEa: "0.28", perInstallment: true });
    const result = applyPrepayment({ target: purchase, amount: d("400000"), date: "2026-02-20", effect: "reduce_term" });
    const rate = monthlyRateFromEA(d("0.28"));
    expect(result.rows!.map((row) => [row.number, row.principal.toString(), row.cutoffDate])).toEqual([[2, "266666.67", "2026-03-15"]]);
    expect(result.rows![0]!.interest.toString()).toBe(d("266666.67").times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
  });

  it("en cuota fija, reducir plazo conserva el pago y reducir cuota lo recalcula", () => {
    const french = target("francesa", { amount: "1000000", count: 4, date: "2026-01-20", rateEa: "0.28", method: "french", perInstallment: true });
    const payment = french.rows[1]!.total;
    const term = applyPrepayment({ target: french, amount: d("300000"), date: "2026-02-20", effect: "reduce_term" });
    expect(term.rows!.length).toBe(2);
    expect(term.rows![0]!.total.equals(payment)).toBe(true);
    expect(term.rows!.at(-1)!.total.lt(payment)).toBe(true);
    const installment = applyPrepayment({ target: french, amount: d("300000"), date: "2026-02-20", effect: "reduce_installment" });
    expect(installment.rows!.length).toBe(3);
    expect(installment.rows![0]!.total.lt(payment)).toBe(true);
    expect(installment.rows!.at(-1)!.balanceAfter.isZero()).toBe(true);
  });

  it("reducir plazo nunca alarga el plan: la última cuota absorbe el redondeo", () => {
    // $100.000 a 7 cuotas: 6 de $14.285,71 y la última de $14.285,74.
    const purchase = target("siete", { amount: "100000", count: 7, date: "2026-01-20" });
    const result = applyPrepayment({ target: purchase, amount: d("0.01"), date: "2026-01-20", effect: "reduce_term" });
    expect(result.replacedFromNumber).toBe(1);
    expect(result.rows!.map((row) => row.principal.toString())).toEqual([...Array(6).fill("14285.71"), "14285.73"]);
  });

  it("en dólares el equivalente COP cuadra con el valor en pesos de la compra", () => {
    const usd = target("usd", { amount: "100", count: 3, date: "2026-01-20", currency: "USD", fxRate: "4000" });
    const result = applyPrepayment({ target: usd, amount: d("20"), date: "2026-02-20", effect: "reduce_term" });
    expect(result.amountCop.toString()).toBe("80000");
    expect(result.rows!.map((row) => [row.principal.toString(), row.principalCop.toString()])).toEqual([["33.33", "133320"], ["13.34", "53360"]]);
    expect(total([usd.rows[0]!.principalCop, result.amountCop, ...result.rows!.map((row) => row.principalCop)]).toString()).toBe("400000");
    const settled = applyPrepayment({ target: usd, amount: d("66.67"), date: "2026-02-20", effect: "reduce_term" });
    expect(settled.rows).toEqual([]);
    expect(settled.amountCop.toString()).toBe("266680");
  });

  it("una compra de una cuota sin facturar recibe el abono sin filas de cuotas", () => {
    const single = target("una", { amount: "50000", count: 1, date: "2026-11-20" });
    expect(applyPrepayment({ target: single, amount: d("20000"), date: "2026-11-30", effect: "reduce_term" })).toEqual({ amountCop: d("20000"), rows: null, replacedFromNumber: null });
    const usd = { ...target("usd", { amount: "10", count: 1, date: "2026-11-20", currency: "USD", fxRate: "4000" }), prepayments: [{ amount: d("4"), amountCop: d("16000") }] };
    expect(pendingAt(usd, "2026-11-30").toString()).toBe("6");
    expect(applyPrepayment({ target: usd, amount: d("6"), date: "2026-11-30", effect: "reduce_term" }).amountCop.toString()).toBe("24000");
    expect(applyPrepayment({ target: { ...usd, prepayments: [] }, amount: d("4"), date: "2026-11-30", effect: "reduce_term" }).amountCop.toString()).toBe("16000");
    // Once its statement is cut, the charge is part of the minimum and no longer receives prepayments.
    expect(pendingAt(single, "2026-12-16").toString()).toBe("0");
    expect(() => applyPrepayment({ target: single, amount: d("1"), date: "2026-12-16", effect: "reduce_term" })).toThrow("supera el saldo");
  });

  it("descuenta los abonos anteriores del saldo pendiente", () => {
    const first = applyPrepayment({ target: advance, amount: d("100000"), date: "2026-11-30", effect: "reduce_term" });
    const after = { ...advance, rows: [...advance.rows.slice(0, 7), ...first.rows!], prepayments: [{ amount: d("100000"), amountCop: first.amountCop }] };
    expect(pendingAt(after, "2026-12-20").toString()).toBe("300000");
    expect(total([...after.rows.map((row) => row.principal), d("100000")]).toString()).toBe("600000");
  });
});

describe("plan de un pago (F14, D37)", () => {
  const debt = target("deuda", { amount: "600000", count: 6, date: "2026-10-10" });
  const open = target("abierta", { amount: "300000", count: 3, date: "2026-11-20" });
  const single = target("una", { amount: "50000", count: 1, date: "2026-11-20" });
  const usd = target("usd", { amount: "100", count: 3, date: "2026-10-10", currency: "USD", fxRate: "4000" });
  const base = { currency: "COP" as const, date: "2026-11-30", statementCutoff: "2026-11-15", targets: [debt, open, single, usd], rule: "bancolombia_priority" as const, effect: "reduce_term" as const };

  it("mínimo: paga el mínimo redondeado hacia arriba sin abonar a capital", () => {
    const plan = buildPaymentPlan({ ...base, kind: "minimum", pending: d("1178835.57") });
    expect([plan.amount.toString(), plan.coversMinimum, plan.prepayments.length, plan.leftover.toString()]).toEqual(["1178836", true, 0, "0.43"]);
    expect(() => buildPaymentPlan({ ...base, kind: "minimum", pending: d(0) })).toThrow("ya está cubierto");
  });

  it("total: liquida las compras de la deuda del extracto y ninguna cuota futura queda", () => {
    const plan = buildPaymentPlan({ ...base, kind: "total", pending: d("150000") });
    expect(plan.amount.toString()).toBe("550000");
    expect(plan.prepayments.map((item) => [item.transactionId, item.amount.toString(), item.rows])).toEqual([["deuda", "400000", []]]);
    expect(plan.leftover.toString()).toBe("0");
    expect(() => buildPaymentPlan({ ...base, targets: [], kind: "total", pending: d(0) })).toThrow("no tiene saldo");
  });

  it("otro valor: cubre el mínimo y reparte el excedente; un pago en pesos nunca toca el saldo en dólares", () => {
    const plan = buildPaymentPlan({ ...base, kind: "other", amount: d("300000"), pending: d("150000") });
    expect([plan.toMinimum.toString(), plan.prepayable.toString(), plan.allocatable.toString()]).toEqual(["150000", "150000", "150000"]);
    expect(plan.prepayments.map((item) => [item.transactionId, item.amount.toString()])).toEqual([["una", "50000"], ["deuda", "100000"]]);
    expect(plan.candidates.map((item) => item.id)).not.toContain("usd");
    const edited = buildPaymentPlan({ ...base, kind: "other", amount: d("300000"), pending: d("150000"), distribution: [{ transactionId: "abierta", amount: d("150000") }] });
    expect(edited.prepayments.map((item) => [item.transactionId, item.rows!.length, item.assumed])).toEqual([["abierta", 2, false]]);
    expect(() => buildPaymentPlan({ ...base, kind: "other", amount: d(0), pending: d("150000") })).toThrow("mayor que cero");
  });

  it("arma el pago para la base: marca pagado si cubre el mínimo y lleva las cuotas rehechas", () => {
    const plan = buildPaymentPlan({ ...base, kind: "other", amount: d("300000"), pending: d("150000") });
    const payload = paymentPayload({ cardId: "card", statementId: "nov", currency: "COP", kind: "other", date: "2026-11-30", fxRate: null, note: "" }, plan);
    expect(payload).toMatchObject({ amount: "300000", amount_cop: "300000", fx_rate: null, mark_paid: true });
    expect(payload.prepayments[0]).toMatchObject({ transaction_id: "una", amount: "50000", installments: null, replaced_from_number: null });
    expect(payload.prepayments[1]).toMatchObject({ transaction_id: "deuda", amount: "100000", replaced_from_number: 3 });
    expect(payload.prepayments[1]!.installments![0]).toMatchObject({ number: 3, cutoff_date: "2026-12-15", principal: "100000", balance_after: "200000" });
    const usdPlan = buildPaymentPlan({ ...base, currency: "USD", kind: "minimum", pending: d("8.22") });
    const usd = paymentPayload({ cardId: "card", statementId: "nov", currency: "USD", kind: "minimum", date: "2026-11-30", fxRate: d("4000.5"), note: "" }, usdPlan);
    expect(usd).toMatchObject({ amount: "9", fx_rate: "4000.5", amount_cop: "36004.5", prepayments: [] });
    expect(() => paymentPayload({ cardId: "card", statementId: "nov", currency: "USD", kind: "minimum", date: "2026-11-30", fxRate: null, note: "" }, usdPlan)).toThrow("TRM");
    expect(usd.cop_debited).toBe(false);
  });

  it("con los pesos debitados guarda su valor exacto y la tasa derivada (D56)", () => {
    const usdPlan = buildPaymentPlan({ ...base, targets: [], currency: "USD", kind: "other", amount: d("153.26"), pending: d("8.22") });
    const payload = paymentPayload({ cardId: "card", statementId: "nov", currency: "USD", kind: "other", date: "2026-11-30", fxRate: d("4000.5"), note: "", copDebited: d(510000) }, usdPlan);
    expect(payload).toMatchObject({ amount: "153.26", fx_rate: "3327.6785", amount_cop: "510000", cop_debited: true });
    // The TRM of D4 is not needed when the pesos are known.
    expect(paymentPayload({ cardId: "card", statementId: "nov", currency: "USD", kind: "other", date: "2026-11-30", fxRate: null, note: "", copDebited: d(510000) }, usdPlan).fx_rate).toBe("3327.6785");
    const pesos = buildPaymentPlan({ ...base, kind: "other", amount: d("300000"), pending: d("150000") });
    expect(() => paymentPayload({ cardId: "card", statementId: "nov", currency: "COP", kind: "other", date: "2026-11-30", fxRate: null, note: "", copDebited: d(300000) }, pesos)).toThrow("solo aplican a pagos en dólares");
    expect(() => paymentPayload({ cardId: "card", statementId: "nov", currency: "USD", kind: "other", date: "2026-11-30", fxRate: null, note: "", copDebited: d(0) }, usdPlan)).toThrow("mayores que cero");
  });

  it("un pago parcial no cubre el mínimo ni abona", () => {
    const plan = buildPaymentPlan({ ...base, kind: "other", amount: d("100000"), pending: d("150000") });
    expect([plan.coversMinimum, plan.prepayments.length, plan.leftover.toString()]).toEqual([false, 0, "0"]);
  });

  it("valida la fecha del pago", () => {
    const statement = { cutoffDate: "2026-11-15", nextCutoff: "2026-12-15" };
    expect(paymentDateError("other", "2026-11-20", statement, "2026-11-19")).toContain("posterior a hoy");
    expect(paymentDateError("minimum", "2026-11-15", statement, "2026-11-19")).toContain("posterior al corte");
    expect(paymentDateError("total", "2026-12-16", statement, "2026-12-20")).toContain("siguiente corte");
    expect(paymentDateError("other", "2026-12-16", statement, "2026-12-20")).toBeNull();
    expect(paymentDateError("total", "2026-12-15", statement, "2026-12-20")).toBeNull();
  });
});

describe("intereses estimados con abonos (R9)", () => {
  it("prorratea por días: un abono a mitad del periodo reduce el interés en esa proporción", () => {
    expect(prepaymentInterestWeight("2026-10-16", "2026-11-15", "2026-10-31").toString()).toBe(d(15).div(31).toString());
    expect(prepaymentInterestWeight("2026-10-16", "2026-11-15", "2026-10-16").toString()).toBe("0");
    expect(prepaymentInterestWeight("2026-10-16", "2026-11-15", "2026-11-16").toString()).toBe("0");
    const basis = { purchaseDate: "2026-01-10", rateEa: d("0.3"), interestFree: false, currency: "COP" as const, fxRate: null };
    const full = estimateBalanceInterest([{ ...basis, principal: d("20000"), balanceAfter: d("180000") }], "2026-10-16");
    // Abono de $100.000 el 31 de octubre: la cuota del extracto se rehízo sobre el saldo reducido.
    const prorated = estimateBalanceInterest([
      { ...basis, principal: d("10000"), balanceAfter: d("90000") },
      { ...basis, principal: d("100000"), balanceAfter: d(0), weight: prepaymentInterestWeight("2026-10-16", "2026-11-15", "2026-10-31") },
    ], "2026-10-16");
    const rate = monthlyRateFromEA(d("0.3"));
    expect(full.byCurrency.COP.toString()).toBe(d("200000").times(rate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
    expect(prorated.byCurrency.COP.toNumber()).toBeCloseTo(d("100000").times(rate).times(d(1).plus(d(15).div(31))).toNumber(), 1);
    expect(prorated.byCurrency.COP.lt(full.byCurrency.COP)).toBe(true);
  });

  it("reduceTermSchedule tolera una cuota sin capital y la cierra en el límite", () => {
    const items = reduceTermSchedule(d("10"), { principal: d(0), total: d(0) }, 3, d(0), "fixed_principal", "COP");
    expect(items.map((item) => item.principal.toString())).toEqual(["0", "0", "10"]);
  });
});
