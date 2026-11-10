import { expect, it } from "vitest";
import { parseColombianDecimal } from "@/lib/money-input";

it("normaliza montos colombianos sin usar números de punto flotante", () => {
  expect(parseColombianDecimal("1.234.567,89")).toBe("1234567.89");
  expect(parseColombianDecimal("1234567")).toBe("1234567");
  expect(parseColombianDecimal("0,5")).toBe("0.5");
});
it("rechaza formato ambiguo, signos y decimales excesivos", () => {
  for (const value of ["-1", "1.23", "1,234", "1.234,", "", "1e3"]) {
    expect(() => parseColombianDecimal(value)).toThrow();
  }
});
