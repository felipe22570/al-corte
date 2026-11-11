import { describe, expect, it } from "vitest";
import { realTotalSchema, statementPaymentDateSchema } from "@/lib/validation/statement";

describe("statement validation", () => {
  it("accepts an empty real total or a nonnegative Colombian amount", () => {
    expect(realTotalSchema.parse("")).toBeNull();
    expect(realTotalSchema.parse("1.234,50")).toBe("1234.5");
    expect(realTotalSchema.parse("0")).toBe("0");
  });
  it("rejects negative, malformed and out-of-range amounts", () => {
    for (const input of ["-1", "abc", "1.000.000.000.000"]) expect(realTotalSchema.safeParse(input).success).toBe(false);
  });
  it("validates business dates", () => {
    expect(statementPaymentDateSchema.safeParse("2028-02-29").success).toBe(true);
    expect(statementPaymentDateSchema.safeParse("2026-02-29").success).toBe(false);
  });
});
