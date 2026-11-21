import { expect, it } from "vitest";
import { transactionSchema } from "@/lib/validation/transaction";

const valid = { cardId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", type: "purchase", date: "2026-01-20", amount: "1.234.567,89", currency: "COP", fxRate: "", installmentsCount: "6", interestFree: false, categoryId: "", merchant: "Tienda", note: "" };
it("normaliza el movimiento y valida fechas y moneda", () => {
  const result = transactionSchema.parse(valid);
  expect(result.amount).toBe("1234567.89");
  expect(result.installmentsCount).toBe(6);
  expect(result.categoryId).toBeNull();
  expect(transactionSchema.parse({ ...valid, amount: "100", currency: "USD", fxRate: "4.123,57" }).fxRate).toBe("4123.57");
});
it("rechaza datos inconsistentes", () => {
  for (const values of [{ amount: "0" }, { date: "2026-02-29" }, { installmentsCount: "37" }, { type: "payment", installmentsCount: "2" }, { currency: "USD", fxRate: "" }, { fxRate: "4.000" }, { cardId: "invalido" }]) {
    expect(transactionSchema.safeParse({ ...valid, ...values }).success).toBe(false);
  }
});
it("arma los datos de una compra en curso copiados del extracto (D49)", () => {
  const result = transactionSchema.parse({ ...valid, installmentsCount: "24", inProgress: true, currentInstallment: "7", balanceAfter: "269.998,46", trackedFromCutoff: "2026-11-15" });
  expect(result.inProgress).toEqual({ currentInstallment: 7, balanceAfter: "269998.46", trackedFromCutoff: "2026-11-15" });
  expect(transactionSchema.parse({ ...valid, inProgress: true, currentInstallment: "3", balanceAfter: "", trackedFromCutoff: "2026-11-15" }).inProgress).toEqual({ currentInstallment: 3, balanceAfter: null, trackedFromCutoff: "2026-11-15" });
  expect(transactionSchema.parse({ ...valid, inProgress: true, currentInstallment: "6", balanceAfter: "0", trackedFromCutoff: "2026-11-15" }).inProgress?.balanceAfter).toBe("0");
  expect(transactionSchema.parse({ ...valid, inProgress: false, currentInstallment: "abc" }).inProgress).toBeNull();
  expect(transactionSchema.parse(valid).inProgress).toBeNull();
});
it("rechaza una compra en curso incompleta o imposible", () => {
  const inProgress = { inProgress: true, currentInstallment: "3", balanceAfter: "", trackedFromCutoff: "2026-11-15" };
  const cases: Array<[Record<string, unknown>, string]> = [
    [{ currentInstallment: "1" }, "currentInstallment"],
    [{ currentInstallment: "7" }, "currentInstallment"],
    [{ currentInstallment: "2,5" }, "currentInstallment"],
    [{ currentInstallment: "73", balanceAfter: "100" }, "currentInstallment"],
    [{ balanceAfter: "-1" }, "balanceAfter"],
    [{ trackedFromCutoff: "" }, "trackedFromCutoff"],
    [{ installmentsCount: "1" }, "inProgress"],
    [{ type: "refund", installmentsCount: "1" }, "inProgress"],
  ];
  for (const [values, path] of cases) {
    const result = transactionSchema.safeParse({ ...valid, ...inProgress, ...values });
    expect(result.success, JSON.stringify(values)).toBe(false);
    expect(result.error?.issues.some((issue) => issue.path[0] === path), JSON.stringify(values)).toBe(true);
  }
  expect(transactionSchema.safeParse({ ...valid, ...inProgress, currentInstallment: "9", balanceAfter: "100" }).success).toBe(true);
});
it("toma la comisión propia de un avance (D41)", () => {
  const advance = { ...valid, type: "cash_advance", installmentsCount: "1" };
  expect(transactionSchema.parse({ ...advance, advanceFee: "7.200,5" }).advanceFee).toBe("7200.5");
  expect(transactionSchema.parse({ ...advance, advanceFee: "0" }).advanceFee).toBe("0");
  expect(transactionSchema.parse(advance).advanceFee).toBeNull();
  expect(transactionSchema.parse({ ...valid, advanceFee: "7.200" }).advanceFee).toBeNull();
  expect(transactionSchema.safeParse({ ...advance, advanceFee: "-1" }).success).toBe(false);
});
