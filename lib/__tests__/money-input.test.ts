import { expect, it } from "vitest";
import { formatAmountInput, parseColombianDecimal } from "@/lib/money-input";

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

it("formats decimal strings back for amount fields", () => {
  expect(formatAmountInput("400000")).toBe("400.000");
  expect(formatAmountInput("4631.68")).toBe("4.631,68");
  expect(formatAmountInput("155001.5")).toBe("155.001,5");
  expect(formatAmountInput("999")).toBe("999");
  expect(parseColombianDecimal(formatAmountInput("1234567.89"))).toBe("1234567.89");
});
