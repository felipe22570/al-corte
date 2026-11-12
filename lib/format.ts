import Decimal from "decimal.js";
import { isValidIsoDate, parseIsoDate, type IsoDate } from "@/lib/domain/dates";
import { toDecimal, type Currency } from "@/lib/domain/money";

type Amount = string | Decimal;
const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const weekdays = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function formatAmount(value: Amount, decimals: number, prefix: string): string {
  const rounded = toDecimal(value).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const [integer = "0", fraction] = rounded.abs().toFixed(decimals).split(".");
  const grouped = new Intl.NumberFormat("es-CO").format(BigInt(integer));
  return `${rounded.isNegative() && !rounded.isZero() ? "-" : ""}${prefix}${grouped}${fraction ? `,${fraction}` : ""}`;
}

export function formatCop(value: Amount) { return formatAmount(value, 0, "$"); }
export function formatUsd(value: Amount) { return formatAmount(value, 2, "US$ "); }
export function formatExchangeRate(value: Amount) { return formatAmount(value, 4, ""); }
export function formatMoney(value: Amount, currency: Currency) { return currency === "COP" ? formatCop(value) : formatUsd(value); }
export function formatSignedMoney(value: Amount, currency: Currency, kind: "charge" | "credit") {
  return `${kind === "credit" ? "+" : "-"}${formatMoney(toDecimal(value).abs(), currency)}`;
}
export function formatDateShort(date: IsoDate, today: IsoDate) {
  const { year, month, day } = parseIsoDate(date);
  const currentYear = parseIsoDate(today).year;
  return `${day} ${months[month - 1]}${year === currentYear ? "" : ` ${year}`}`;
}
export function formatDateWithWeekday(date: IsoDate, today: IsoDate) {
  const { year, month, day } = parseIsoDate(date);
  const offsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  const y = year - (month < 3 ? 1 : 0);
  const weekday = (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) + offsets[month - 1]! + day) % 7;
  return `${weekdays[weekday]} ${formatDateShort(date, today)}`;
}
export function formatDateInput(date: string) {
  if (!isValidIsoDate(date)) return date;
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}
export function formatMonth(month: string, style: "short" | "long" = "short") {
  const { year, month: number } = parseIsoDate(`${month}-01`);
  return `${(style === "long" ? monthNames : months)[number - 1]} ${String(year).padStart(4, "0")}`;
}
export function formatPercent(value: string | Decimal) { return `${toDecimal(value).times(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toString()}%`; }
export function formatRate(value: string | Decimal) { return `${toDecimal(value).times(100).toFixed(2, Decimal.ROUND_HALF_UP).replace(".", ",")}% E.A.`; }
export function formatDueIn(days: number) {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 0) return `hace ${-days} ${days === -1 ? "día" : "días"}`;
  return `en ${days} días`;
}
