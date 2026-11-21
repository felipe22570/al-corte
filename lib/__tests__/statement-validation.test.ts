import { describe, expect, it } from "vitest";
import { statementCloseSchema, statementPaymentDateSchema } from "@/lib/validation/statement";

describe("statement validation", () => {
  it("accepts empty or nonnegative Colombian amounts in the close (D39)", () => {
    const parsed = statementCloseSchema.parse({ realMinimum: "", realTotal: "1.234,50", interest: "0", rate: "2,1003" });
    expect(parsed.realMinimum).toBeNull();
    expect(parsed.realTotal?.toString()).toBe("1234.5");
    expect(parsed.interest?.toString()).toBe("0");
    expect(parsed.rate?.toString()).toBe("0.021003");
    expect(parsed).toMatchObject({ lateInterest: null, rateUnit: "mv", balances: [], reconcile: false });
  });
  it("rejects negative, malformed and out-of-range amounts and rates", () => {
    for (const input of ["-1", "abc", "1.000.000.000.000"]) expect(statementCloseSchema.safeParse({ realTotal: input }).success).toBe(false);
    for (const rate of ["0", "2,12345", "1001"]) expect(statementCloseSchema.safeParse({ rate }).success).toBe(false);
    expect(statementCloseSchema.safeParse({ balances: [{ transactionId: "no", bankBalance: "1" }] }).success).toBe(false);
  });
  it("validates business dates", () => {
    expect(statementPaymentDateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(statementPaymentDateSchema.safeParse("2026-02-29").success).toBe(false);
  });
});
