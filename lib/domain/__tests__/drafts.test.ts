import { describe, expect, it } from "vitest";

import { sameMovementCandidates, subscriptionAmountChange } from "../drafts";

const draft = { cardId: "visa", amount: "140910.00", currency: "COP" as const, date: "2026-11-17" };
const candidate = { id: "t1", cardId: "visa", amount: "140910", currency: "COP" as const, date: "2026-11-17", linked: false };

describe("sameMovementCandidates", () => {
  it("proposes a movement with the same card, amount, currency and date (D46)", () => {
    expect(sameMovementCandidates(draft, [candidate]).map((item) => item.id)).toEqual(["t1"]);
  });

  it.each([
    ["another card", { cardId: "mastercard" }],
    ["another amount", { amount: "140910.01" }],
    ["another currency", { currency: "USD" as const }],
    ["another date", { date: "2026-11-18" }],
    ["a movement already linked to another draft", { linked: true }],
  ])("ignores %s", (_, change) => {
    expect(sameMovementCandidates(draft, [{ ...candidate, ...change }])).toEqual([]);
  });

  it.each([
    ["an unknown card", { cardId: null }],
    ["an amount the rules could not read", { amount: null }],
    ["no currency", { currency: null }],
    ["no date", { date: null }],
  ])("proposes nothing with %s", (_, change) => {
    expect(sameMovementCandidates({ ...draft, ...change }, [candidate])).toEqual([]);
  });
});

describe("subscriptionAmountChange", () => {
  it("warns when the charge differs from the subscription", () => {
    expect(subscriptionAmountChange(draft, { amount: "83350", currency: "COP" })).toEqual({ charged: "140910.00", expected: "83350", currency: "COP" });
  });

  it("stays silent when the amount is the same", () => {
    expect(subscriptionAmountChange(draft, { amount: "140910", currency: "COP" })).toBeNull();
  });

  it("does not compare a subscription in another currency or a draft without amount", () => {
    expect(subscriptionAmountChange({ amount: "81000", currency: "COP" }, { amount: "20", currency: "USD" })).toBeNull();
    expect(subscriptionAmountChange({ amount: null, currency: "COP" }, { amount: "20", currency: "COP" })).toBeNull();
  });
});
