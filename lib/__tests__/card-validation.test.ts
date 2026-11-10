import { expect, it } from "vitest";
import { cardSchema } from "@/lib/validation/card";
import { categorySchema } from "@/lib/validation/category";

const card = { name: "Visa", bank: "Banco", network: "Visa", last4: "1234", creditLimit: "1.234.567,89", advanceFee: "0", handlingFee: "10.000", cutoffDay: "31", paymentDay: "15", purchaseRateEa: "28,5", advanceRateEa: "30", amortizationMethod: "fixed_principal", color: "card-3" };
it("valida y convierte montos y tasas sin perder precisión", () => {
  const result = cardSchema.parse(card);
  expect(result.creditLimit).toBe("1234567.89");
  expect(result.purchaseRateEa).toBe("0.285");
  expect(result.cutoffDay).toBe(31);
});
it("rechaza datos inválidos", () => {
  for (const field of [{ cutoffDay: "0" }, { paymentDay: "32" }, { last4: "12a4" }, { purchaseRateEa: "-1" }, { color: "#ff0000" }, { creditLimit: "1234.56" }, { creditLimit: "1.000.000.000.000" }]) {
    expect(cardSchema.safeParse({ ...card, ...field }).success).toBe(false);
  }
  expect(categorySchema.safeParse({ name: "Mercado", icon: "shopping-cart" }).success).toBe(true);
  expect(categorySchema.safeParse({ name: "", icon: "invalid" }).success).toBe(false);
});
