import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { monthlyRateFromEA } from "@/lib/domain/rates";

describe("rates", () => {
  it("converts effective annual rate to monthly rate", () => {
    expect(monthlyRateFromEA(new Decimal(0)).toString()).toBe("0");
    expect(monthlyRateFromEA(new Decimal("0.28")).toDecimalPlaces(9).toString()).toBe("0.020784728");
  });

  it("rejects negative annual rates", () => {
    expect(() => monthlyRateFromEA(new Decimal("-0.01"))).toThrow("no puede ser negativa");
  });
});
