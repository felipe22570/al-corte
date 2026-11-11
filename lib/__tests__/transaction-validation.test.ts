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
