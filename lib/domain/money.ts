import Decimal from "decimal.js";

export type Currency = "COP" | "USD";

export function toDecimal(value: string | Decimal): Decimal {
  if (typeof value === "string" || Decimal.isDecimal(value)) return new Decimal(value);
  throw new Error("El monto debe ser Decimal o string");
}

export function roundMoney(value: Decimal, currency: Currency): Decimal {
  return new Decimal(value).toDecimalPlaces(currency === "COP" ? 0 : 2, Decimal.ROUND_HALF_UP);
}

export function toCop(amount: Decimal, currency: Currency, fxRate?: Decimal): Decimal {
  if (currency === "COP") {
    if (fxRate) throw new Error("La TRM no aplica para COP");
    return new Decimal(amount);
  }
  if (!fxRate || !fxRate.gt(0)) throw new Error("La TRM es obligatoria para USD");
  return roundMoney(amount.times(fxRate), "COP");
}
