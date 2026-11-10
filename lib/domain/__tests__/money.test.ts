import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { roundMoney, toCop, toDecimal } from "@/lib/domain/money";

describe("money", () => {
  it("converts only strings and Decimal values", () => {
    expect(toDecimal("123.45").equals("123.45")).toBe(true);
    expect(toDecimal(new Decimal("123.45")).equals("123.45")).toBe(true);
    expect(() => toDecimal(1.1 as never)).toThrow("Decimal o string");
  });

  it("rounds COP and USD with HALF_UP", () => {
    expect(roundMoney(new Decimal("0.5"), "COP").toString()).toBe("1");
    expect(roundMoney(new Decimal("1.5"), "COP").toString()).toBe("2");
    expect(roundMoney(new Decimal("1.005"), "USD").toString()).toBe("1.01");
  });

  it("converts USD to COP and rejects missing or inapplicable exchange rates", () => {
    expect(toCop(new Decimal("10.25"), "USD", new Decimal("4123.57")).toString()).toBe("42267");
    expect(toCop(new Decimal("100"), "COP").toString()).toBe("100");
    expect(() => toCop(new Decimal("10"), "USD")).toThrow("TRM");
    expect(() => toCop(new Decimal("10"), "COP", new Decimal("4000"))).toThrow("no aplica");
  });
});
