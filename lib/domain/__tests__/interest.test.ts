import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { estimateBalanceInterest, type BalanceInterestInstallment } from "@/lib/domain/interest";

const d = (value: string) => new Decimal(value);
const row = (overrides: Partial<BalanceInterestInstallment>): BalanceInterestInstallment => ({
  principal: d("100000"), balanceAfter: d("400000"), purchaseDate: "2026-08-01", rateEa: d("0.2899"), interestFree: false, currency: "COP", fxRate: null, ...overrides,
});

describe("intereses sobre saldo (R8, D32)", () => {
  it("suma el capital pendiente de cada compra y avance con interés por su propia tasa mensual", () => {
    const estimate = estimateBalanceInterest([
      row({ principal: d("112965"), balanceAfter: d("225930") }),
      row({ purchaseDate: "2026-09-01", rateEa: d("0.36"), principal: d("100000"), balanceAfter: d("400000") }),
      row({ interestFree: true }),
      row({ purchaseDate: "2026-10-20" }),
      row({ rateEa: d("0") }),
      row({ rateEa: null }),
      row({ currency: "USD", fxRate: d("4000"), purchaseDate: "2026-07-01", principal: d("0.31"), balanceAfter: d("7.33") }),
    ], "2026-10-16");
    expect(estimate.byCurrency.COP.toString()).toBe("20243.44");
    expect(estimate.byCurrency.USD.toString()).toBe("0.16");
    expect(estimate.amountCop.toString()).toBe("20883.44");
    expect(estimate.copByCurrency.USD.toString()).toBe("640");
    expect(estimate.copByCurrency.COP.toString()).toBe("20243.44");
  });

  it("no estima nada sin compras con interés vigentes al inicio del periodo", () => {
    const estimate = estimateBalanceInterest([row({ purchaseDate: "2026-10-16" })], "2026-10-16");
    expect(estimate.amountCop.isZero()).toBe(true);
    expect(estimate.byCurrency.USD.isZero()).toBe(true);
  });
});
