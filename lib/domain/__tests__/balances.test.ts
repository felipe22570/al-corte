import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { bankDifference, statementPaidAt } from "@/lib/domain/balances";

const d = (value: string) => new Decimal(value);

describe("saldos por moneda (D33)", () => {
  it("oculta la diferencia que el banco explica con su redondeo hacia arriba", () => {
    expect(bankDifference(d("1178835.57"), d("1178836"))).toBeNull();
    expect(bankDifference(d("8.22"), d("9"))).toBeNull();
    expect(bankDifference(d("153.26"), d("154"))).toBeNull();
    expect(bankDifference(d("100"), d("101"))).toBeNull();
    expect(bankDifference(d("100"), null)).toBeNull();
  });

  it("muestra la diferencia cuando supera el redondeo o el banco cobra menos", () => {
    expect(bankDifference(d("100"), d("101.01"))?.toString()).toBe("1.01");
    expect(bankDifference(d("100"), d("99.99"))?.toString()).toBe("-0.01");
  });

  it("solo da por pagado el extracto cuando todas las monedas con cargos están marcadas", () => {
    expect(statementPaidAt({ COP: "2026-12-01T05:00:00Z" }, ["COP"])).toBe("2026-12-01T05:00:00Z");
    expect(statementPaidAt({ COP: "2026-12-01T05:00:00Z" }, ["COP", "USD"])).toBeNull();
    expect(statementPaidAt({ COP: "2026-12-01T05:00:00Z", USD: "2026-12-03T05:00:00Z" }, ["COP", "USD"])).toBe("2026-12-03T05:00:00Z");
    expect(statementPaidAt({ USD: "2026-12-03T05:00:00Z" }, ["USD"])).toBe("2026-12-03T05:00:00Z");
    expect(statementPaidAt({ COP: "2026-12-01T05:00:00Z" }, [])).toBe("2026-12-01T05:00:00Z");
    expect(statementPaidAt({}, [])).toBeNull();
  });
});
