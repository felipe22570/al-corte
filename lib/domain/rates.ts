import Decimal from "decimal.js";

const HighPrecisionDecimal = Decimal.clone({ precision: 40 });

export function monthlyRateFromEA(annualRateEa: Decimal): Decimal {
  if (annualRateEa.lt(0)) throw new Error("La tasa anual no puede ser negativa");
  if (annualRateEa.isZero()) return new Decimal(0);
  return new Decimal(new HighPrecisionDecimal(annualRateEa.toString()).plus(1).pow(new HighPrecisionDecimal(1).div(12)).minus(1).toString());
}
