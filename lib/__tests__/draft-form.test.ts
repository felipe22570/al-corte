import { describe, expect, it } from "vitest";

import { draftFormStart, type DraftForForm } from "../draft-form";
import { parseDraftSuggestions } from "../validation/transaction-draft";

const card = "11111111-1111-4111-8111-111111111111";
const category = "22222222-2222-4222-8222-222222222222";
const context = { cardIds: [card], categoryIds: [category], today: "2026-11-22", latestRate: "3301.91" };
const directv: DraftForForm = { cardId: card, type: "purchase", amount: "140910.00", currency: "COP", merchantRaw: "DIRECTV", occurredOn: "2026-11-17", suggestions: null };

describe("draftFormStart", () => {
  it("fills the form with the alert facts and nothing else without suggestions", () => {
    const { values, touched } = draftFormStart(directv, context);
    expect(values).toMatchObject({ cardId: card, type: "purchase", date: "2026-11-17", amount: "140.910", currency: "COP", fxRate: "", merchant: "DIRECTV", categoryId: "", installmentsCount: "1", isInternational: false });
    // The alert currency is a fact: the merchant history never changes it (R10, D53).
    expect(touched).toEqual(["currency", "fxRate"]);
  });

  it("adds AI suggestions only for name, category, installments and international flag", () => {
    const suggestions = parseDraftSuggestions({ merchantName: "Google ChatGPT", categoryId: category, billingCurrency: "USD", installmentsCount: 36, isInternational: true, confidence: "media" });
    const { values, touched } = draftFormStart({ ...directv, amount: "81000.00", merchantRaw: "GOOGLE *ChatGPT", suggestions }, context);
    expect(values).toMatchObject({ amount: "81.000", currency: "COP", fxRate: "", merchant: "Google ChatGPT", categoryId: category, installmentsCount: "36", isInternational: true });
    expect(touched).toEqual(["currency", "fxRate", "categoryId", "installmentsCount", "isInternational"]);
  });

  it("ignores a category that is no longer available and installments for movements without them", () => {
    const suggestions = parseDraftSuggestions({ categoryId: "33333333-3333-4333-8333-333333333333", installmentsCount: 12, isInternational: false, confidence: "baja" });
    const { values, touched } = draftFormStart({ ...directv, type: "refund", suggestions }, context);
    expect(values).toMatchObject({ type: "refund", categoryId: "", installmentsCount: "1", isInternational: false });
    expect(touched).toEqual(["currency", "fxRate"]);
  });

  it("uses the latest TRM for a dollar alert and leaves an unknown card to choose", () => {
    const { values } = draftFormStart({ ...directv, cardId: null, currency: "USD", amount: "15.99" }, context);
    expect(values).toMatchObject({ cardId: "", currency: "USD", fxRate: "3301,91", amount: "15,99", isInternational: true });
  });

  it("starts a draft for review with today and empty facts", () => {
    const { values } = draftFormStart({ cardId: "44444444-4444-4444-8444-444444444444", type: null, amount: null, currency: null, merchantRaw: null, occurredOn: null, suggestions: null }, context);
    expect(values).toMatchObject({ cardId: "", type: "purchase", date: "2026-11-22", amount: "", currency: "COP", merchant: "" });
  });
});

describe("parseDraftSuggestions", () => {
  it("drops stored suggestions that no longer validate", () => {
    expect(parseDraftSuggestions(null)).toBeNull();
    expect(parseDraftSuggestions({ confidence: "segura" })).toBeNull();
    expect(parseDraftSuggestions({ confidence: "alta", amount: "1" })).toBeNull();
    expect(parseDraftSuggestions({ confidence: "alta" })).toEqual({ merchantName: null, categoryId: null, subscriptionId: null, billingCurrency: null, installmentsCount: null, isInternational: null, confidence: "alta", reason: null });
  });
});
