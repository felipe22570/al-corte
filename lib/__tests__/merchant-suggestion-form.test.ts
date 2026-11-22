import { describe, expect, it } from "vitest";
import type { MerchantHistoryRow } from "@/lib/domain/merchant-suggestions";
import { applySuggestion, currencyEffects, revertSuggestion, suggestionNotice, type SuggestionField } from "@/lib/merchant-suggestion-form";
import type { TransactionInput } from "@/lib/validation/transaction";

const values: TransactionInput = { cardId: "visa", type: "purchase", date: "2026-11-21", amount: "", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, isInternational: false, advanceFee: "", categoryId: "", merchant: "Netflix", note: "" };
const netflix: MerchantHistoryRow = { id: "t1", merchant: "DLO*Netflix", cardId: "visa", date: "2026-11-07", createdAt: "2026-11-07T10:00:00Z", type: "purchase", categoryId: "subs", installmentsCount: 36, currency: "USD", isInternational: true, interestFree: false };
const ctx = { latestRate: "3301.91", categoryIds: ["subs", "food"] };
const none = new Set<SuggestionField>();

describe("currencyEffects", () => {
  it("preloads the latest TRM and marks USD as international (D4)", () => {
    expect(currencyEffects("USD", "3301.91")).toEqual({ fxRate: "3301,91", isInternational: true });
    expect(currencyEffects("USD", null)).toEqual({ fxRate: "", isInternational: true });
    expect(currencyEffects("COP", "3301.91")).toEqual({ fxRate: "", isInternational: false });
  });
});

describe("applySuggestion (D53)", () => {
  it("fills every untouched field and runs the same effects as choosing USD by hand", () => {
    const { patch, previous } = applySuggestion(values, netflix, none, ctx);
    expect(patch).toEqual({ categoryId: "subs", currency: "USD", fxRate: "3301,91", isInternational: true, installmentsCount: "36" });
    expect(previous).toEqual({ categoryId: "", currency: "COP", fxRate: "", isInternational: false, installmentsCount: "1" });
  });

  it("never overwrites a field the owner touched", () => {
    const touched = new Set<SuggestionField>(["categoryId", "installmentsCount", "fxRate"]);
    const { patch } = applySuggestion({ ...values, categoryId: "food", installmentsCount: "2" }, netflix, touched, ctx);
    expect(patch).toEqual({ currency: "USD", isInternational: true });
  });

  it("treats every field as touched when they all are, as in a restored draft", () => {
    const touched = new Set<SuggestionField>(["categoryId", "currency", "fxRate", "installmentsCount", "isInternational", "interestFree"]);
    expect(applySuggestion(values, netflix, touched, ctx)).toEqual({ patch: {}, previous: {} });
  });

  it("replaces the installments set by the USD default (D34), which are not touched", () => {
    const afterUsd = { ...values, currency: "USD" as const, fxRate: "3301,91", isInternational: true, installmentsCount: "36" };
    const { patch } = applySuggestion(afterUsd, { ...netflix, installmentsCount: 1 }, new Set<SuggestionField>(["currency"]), ctx);
    expect(patch).toEqual({ categoryId: "subs", installmentsCount: "1" });
  });

  it("keeps the owner's currency and does not copy the international flag of another currency", () => {
    const { patch } = applySuggestion(values, netflix, new Set<SuggestionField>(["currency"]), ctx);
    expect(patch).toEqual({ categoryId: "subs", installmentsCount: "36" });
  });

  it("suggests interest-free only for purchases and skips archived categories", () => {
    const row = { ...netflix, currency: "COP" as const, isInternational: false, interestFree: true, installmentsCount: 3, categoryId: "archived" };
    expect(applySuggestion(values, row, none, ctx).patch).toEqual({ interestFree: true, installmentsCount: "3" });
    const advance = { ...values, type: "cash_advance" as const };
    expect(applySuggestion(advance, { ...row, type: "cash_advance" }, none, ctx).patch).toEqual({ installmentsCount: "3" });
  });

  it("suggests no category when the last purchase had none", () => {
    expect(applySuggestion({ ...values, categoryId: "food" }, { ...netflix, categoryId: null, currency: "COP", isInternational: false, installmentsCount: 1 }, none, ctx).patch).toEqual({ categoryId: "" });
  });

  it("compares numeric installments with their text form", () => {
    expect(applySuggestion({ ...values, installmentsCount: 36, currency: "USD", fxRate: "1", isInternational: true, categoryId: "subs" }, netflix, none, ctx).patch).toEqual({});
  });
});

describe("revertSuggestion", () => {
  it("restores previous values except the ones touched afterwards", () => {
    const { previous } = applySuggestion(values, netflix, none, ctx);
    expect(revertSuggestion(previous, none)).toEqual(previous);
    expect(revertSuggestion(previous, new Set<SuggestionField>(["installmentsCount"]))).toEqual({ categoryId: "", currency: "COP", fxRate: "", isInternational: false });
  });
});

describe("suggestionNotice", () => {
  it("names the merchant, the date and the card when it is another one", () => {
    expect(suggestionNotice(netflix, "2026-11-21")).toBe("Como tu última compra en DLO*Netflix (7 nov)");
    expect(suggestionNotice({ ...netflix, type: "cash_advance", merchant: "Cajero", date: "2025-12-02" }, "2026-11-21", "Mastercard")).toBe("Como tu último avance en Cajero con Mastercard (2 dic 2025)");
  });
});
