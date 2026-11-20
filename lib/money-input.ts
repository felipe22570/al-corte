import Decimal from "decimal.js";

/** Normaliza entrada es-CO; los puntos separan miles y la coma los decimales. */
export function parseColombianDecimal(value: string, decimalPlaces = 2): string {
  const text = value.trim();
  const pattern = new RegExp(`^(?:\\d+|\\d{1,3}(?:\\.\\d{3})+)(?:,\\d{1,${decimalPlaces}})?$`);
  if (!pattern.test(text)) throw new Error("Ingresa un valor válido, por ejemplo 1.234,50.");
  return new Decimal(text.replaceAll(".", "").replace(",", ".")).toFixed();
}

/** Inverse of `parseColombianDecimal` for a decimal string: thousands with dots and the cents, if any, after a comma. */
export function formatAmountInput(value: string): string {
  const [integer, fraction] = new Decimal(value).toFixed().split(".");
  const grouped = integer!.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction ? `${grouped},${fraction}` : grouped;
}
