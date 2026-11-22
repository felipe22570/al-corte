import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { availableCredit, exchangeDifference, paidUsdEquivalent, rateFromPesos } from "@/lib/domain/fx-difference";

const d = (value: string | number) => new Decimal(value);
// Charges in dollars of a statement with different TRMs: US$100 at $3.000 and US$54 at $3.500 → $489.000.
const charges = { usd: d(154), cop: d(489000) };

describe("pago en dólares con pesos (D56)", () => {
  it("deriva la tasa de los pesos debitados con 4 decimales", () => {
    expect(rateFromPesos(d(154), d(510000)).toFixed()).toBe("3311.6883");
    expect(rateFromPesos(d("153.26"), d(510000)).toFixed()).toBe("3327.6785");
  });

  it("calcula la diferencia cambiaria contra el equivalente de los cargos del extracto", () => {
    expect(exchangeDifference({ paidUsd: d(154), paidCop: d(510000), chargesUsd: charges.usd, chargesCop: charges.cop })).toEqual({ reference: d(489000), difference: d(21000) });
    // A partial payment compares only the dollars paid.
    expect(exchangeDifference({ paidUsd: d(77), paidCop: d(240000), chargesUsd: charges.usd, chargesCop: charges.cop })).toEqual({ reference: d(244500), difference: d(-4500) });
    expect(exchangeDifference({ paidUsd: d(10), paidCop: d(33000), chargesUsd: d(0), chargesCop: d(0) })).toBeNull();
  });

  it("el equivalente del mes usa los pesos pagados por la parte pagada y la referencia por el resto", () => {
    expect(paidUsdEquivalent({ totalUsd: charges.usd, referenceCop: charges.cop, payments: [{ usd: d(154), cop: d(510000) }] }).toFixed()).toBe("510000");
    expect(paidUsdEquivalent({ totalUsd: charges.usd, referenceCop: charges.cop, payments: [{ usd: d(77), cop: d(255000) }] }).toFixed()).toBe("499500");
    expect(paidUsdEquivalent({ totalUsd: charges.usd, referenceCop: charges.cop, payments: [] }).toFixed()).toBe("489000");
  });

  it("un pago mayor que los dólares del extracto solo aporta su parte proporcional", () => {
    expect(paidUsdEquivalent({ totalUsd: charges.usd, referenceCop: charges.cop, payments: [{ usd: d(150), cop: d(495000) }, { usd: d(50), cop: d(165000) }] }).toFixed()).toBe("508200");
    expect(paidUsdEquivalent({ totalUsd: d(0), referenceCop: d(0), payments: [{ usd: d(10), cop: d(33000) }] }).toFixed()).toBe("0");
  });
});

describe("cupo con la deuda en dólares (D52)", () => {
  it("suma los pesos y los dólares netos a la TRM indicada, redondeados a centavos", () => {
    expect(availableCredit({ creditLimit: d(2000000), copUsed: d(100000), usdNet: d("153.26"), trm: d("3301.91") }).toFixed()).toBe(d(2000000).minus(100000).minus("506050.73").toFixed());
    expect(availableCredit({ creditLimit: d(2000000), copUsed: d(0), usdNet: d(0), trm: d(4000) }).toFixed()).toBe("2000000");
  });
});
