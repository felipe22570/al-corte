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
});
