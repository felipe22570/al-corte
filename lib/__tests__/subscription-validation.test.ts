import { describe, expect, it } from "vitest";
import { subscriptionSchema } from "@/lib/validation/subscription";

const valid = { name: "Servicio", cardId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", categoryId: "", amount: "15,99", currency: "USD", frequency: "monthly", billingDay: "31", startDate: "2026-01-01", trialEndsAt: "" };
describe("subscription validation", () => {
  it("normalizes money and optional fields", () => {
    expect(subscriptionSchema.parse(valid)).toMatchObject({ amount: "15.99", billingDay: 31, categoryId: null, trialEndsAt: null });
  });
  it("rejects invalid amounts, dates, days and categories", () => {
    for (const input of [{ ...valid, amount: "0" }, { ...valid, billingDay: "32" }, { ...valid, startDate: "2026-02-30" }, { ...valid, categoryId: "invalid" }, { ...valid, trialEndsAt: "2026-02-30" }]) expect(subscriptionSchema.safeParse(input).success).toBe(false);
  });
  it("acepta cuotas por cobro y rechaza un valor que no alcanza para ellas (D35)", () => {
    expect(subscriptionSchema.parse(valid).installmentsCount).toBe(1);
    expect(subscriptionSchema.parse({ ...valid, amount: "12,99", installmentsCount: "36" }).installmentsCount).toBe(36);
    for (const input of [{ ...valid, amount: "0,54", installmentsCount: "36" }, { ...valid, amount: "0,01", installmentsCount: "2" }, { ...valid, installmentsCount: "37" }, { ...valid, installmentsCount: "0" }]) {
      const result = subscriptionSchema.safeParse(input);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["installmentsCount"]);
    }
  });
});
