import { describe, expect, it } from "vitest";
import { decodeTransactionDraft, encodeTransactionDraft, transactionDraftKey } from "@/lib/transaction-draft";
import type { TransactionInput } from "@/lib/validation/transaction";

const values: TransactionInput = { cardId: "", type: "purchase", date: "12/", amount: "", currency: "COP", fxRate: "", installmentsCount: "6", interestFree: false, categoryId: "", merchant: "Mercado", note: "Por completar" };

describe("transaction drafts", () => {
  it("keeps incomplete user input without treating it as a valid transaction", () => {
    expect(decodeTransactionDraft(encodeTransactionDraft(values, "new", 1000), "new", 2000)).toEqual(values);
  });
  it("isolates owners, new movements, and individual edits", () => {
    expect(transactionDraftKey("owner")).toBe("al-corte:transaction-draft:owner:new");
    expect(transactionDraftKey("owner", "one")).not.toBe(transactionDraftKey("other", "one"));
    expect(transactionDraftKey("owner", "one")).not.toBe(transactionDraftKey("owner", "two"));
  });
  it("does not restore edits over a changed original", () => {
    expect(decodeTransactionDraft(encodeTransactionDraft(values, "old", 1000), "changed", 2000)).toBeNull();
  });
  it("rejects corrupt, oversized, unknown-version, and expired drafts", () => {
    const raw = encodeTransactionDraft(values, "new", 1000);
    expect(decodeTransactionDraft(null, "new", 2000)).toBeNull();
    expect(decodeTransactionDraft("{", "new", 2000)).toBeNull();
    expect(decodeTransactionDraft("x".repeat(20001), "new", 2000)).toBeNull();
    expect(decodeTransactionDraft(raw.replace('"version":1', '"version":2'), "new", 2000)).toBeNull();
    expect(decodeTransactionDraft(raw, "new", 1000 + 86400001)).toBeNull();
    expect(decodeTransactionDraft(raw, "new", 999)).toBeNull();
  });
  it("rejects unexpected fields and malformed input types", () => {
    expect(() => encodeTransactionDraft({ ...values, interestFree: "yes" } as unknown as TransactionInput, "new", 1000)).toThrow();
    const object = JSON.parse(encodeTransactionDraft(values, "new", 1000));
    object.values.unexpected = "not persisted";
    expect(decodeTransactionDraft(JSON.stringify(object), "new", 2000)).toBeNull();
  });
});
