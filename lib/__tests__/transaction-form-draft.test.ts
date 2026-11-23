import { describe, expect, it } from "vitest";
import { decodeTransactionFormDraft, encodeTransactionFormDraft, transactionFormDraftKey } from "@/lib/transaction-form-draft";
import type { TransactionInput } from "@/lib/validation/transaction";

const values: TransactionInput = { cardId: "", type: "purchase", date: "12/", amount: "", currency: "COP", fxRate: "", installmentsCount: "6", interestFree: false, categoryId: "", merchant: "Mercado", note: "Por completar" };

describe("transaction form drafts", () => {
  it("keeps incomplete user input without treating it as a valid transaction", () => {
    expect(decodeTransactionFormDraft(encodeTransactionFormDraft(values, "new", 1000), "new", 2000)).toEqual(values);
  });
  it("isolates owners, new movements, and individual edits", () => {
    expect(transactionFormDraftKey("owner")).toBe("al-corte:transaction-draft:owner:new");
    expect(transactionFormDraftKey("owner", "one")).not.toBe(transactionFormDraftKey("other", "one"));
    expect(transactionFormDraftKey("owner", "one")).not.toBe(transactionFormDraftKey("owner", "two"));
  });
  it("does not restore edits over a changed original", () => {
    expect(decodeTransactionFormDraft(encodeTransactionFormDraft(values, "old", 1000), "changed", 2000)).toBeNull();
  });
  it("rejects corrupt, oversized, unknown-version, and expired drafts", () => {
    const raw = encodeTransactionFormDraft(values, "new", 1000);
    expect(decodeTransactionFormDraft(null, "new", 2000)).toBeNull();
    expect(decodeTransactionFormDraft("{", "new", 2000)).toBeNull();
    expect(decodeTransactionFormDraft("x".repeat(20001), "new", 2000)).toBeNull();
    expect(decodeTransactionFormDraft(raw.replace('"version":1', '"version":2'), "new", 2000)).toBeNull();
    expect(decodeTransactionFormDraft(raw, "new", 1000 + 86400001)).toBeNull();
    expect(decodeTransactionFormDraft(raw, "new", 999)).toBeNull();
  });
  it("rejects unexpected fields and malformed input types", () => {
    expect(() => encodeTransactionFormDraft({ ...values, interestFree: "yes" } as unknown as TransactionInput, "new", 1000)).toThrow();
    const object = JSON.parse(encodeTransactionFormDraft(values, "new", 1000));
    object.values.unexpected = "not persisted";
    expect(decodeTransactionFormDraft(JSON.stringify(object), "new", 2000)).toBeNull();
  });
});
