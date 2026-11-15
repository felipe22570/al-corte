import { formatInTimeZone } from "date-fns-tz";

export type IsoDate = string;

export const TIME_ZONE = "America/Bogota";

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function assertIntegerInRange(value: number, minimum: number, maximum: number, label: string) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} inválido`);
  }
}

export function daysInMonth(year: number, month: number): number {
  assertIntegerInRange(year, 1, 9999, "Año");
  assertIntegerInRange(month, 1, 12, "Mes");

  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function formatIsoDate(year: number, month: number, day: number): IsoDate {
  const lastDay = daysInMonth(year, month);
  assertIntegerInRange(day, 1, lastDay, "Día");

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseIsoDate(date: IsoDate): DateParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error(`Fecha inválida: ${date}`);
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  try {
    formatIsoDate(year, month, day);
  } catch {
    throw new Error(`Fecha inválida: ${date}`);
  }

  return { year, month, day };
}

export function isValidIsoDate(date: string): boolean {
  try {
    parseIsoDate(date);
    return true;
  } catch {
    return false;
  }
}

export function clampDay(year: number, month: number, day: number): IsoDate {
  assertIntegerInRange(day, 1, 31, "Día");
  return formatIsoDate(year, month, Math.min(day, daysInMonth(year, month)));
}

export function addMonths(date: IsoDate, months: number): IsoDate {
  assertIntegerInRange(months, -119_988, 119_988, "Número de meses");

  const { year, month, day } = parseIsoDate(date);
  const monthIndex = year * 12 + month - 1 + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = (monthIndex % 12) + 1;

  return clampDay(targetYear, targetMonth, day);
}

function daysFromCivil({ year, month, day }: DateParts): number {
  const adjustedYear = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(adjustedYear / 400);
  const yearOfEra = adjustedYear - era * 400;
  const marchMonth = month + (month > 2 ? -3 : 9);
  const dayOfYear = Math.floor((153 * marchMonth + 2) / 5) + day - 1;
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;

  return era * 146_097 + dayOfEra;
}

function civilFromDays(days: number): DateParts {
  const era = Math.floor(days / 146_097);
  const dayOfEra = days - era * 146_097;
  const yearOfEra = Math.floor((dayOfEra - Math.floor(dayOfEra / 1460) + Math.floor(dayOfEra / 36_524) - Math.floor(dayOfEra / 146_096)) / 365);
  let year = yearOfEra + era * 400;
  const dayOfYear = dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const marchMonth = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * marchMonth + 2) / 5) + 1;
  const month = marchMonth + (marchMonth < 10 ? 3 : -9);
  year += month <= 2 ? 1 : 0;

  return { year, month, day };
}

export function addDays(date: IsoDate, days: number): IsoDate {
  assertIntegerInRange(days, -3_652_058, 3_652_058, "Número de días");

  const target = civilFromDays(daysFromCivil(parseIsoDate(date)) + days);
  return formatIsoDate(target.year, target.month, target.day);
}

export function compareIsoDates(first: IsoDate, second: IsoDate): -1 | 0 | 1 {
  const firstDays = daysFromCivil(parseIsoDate(first));
  const secondDays = daysFromCivil(parseIsoDate(second));

  if (firstDays === secondDays) {
    return 0;
  }

  return firstDays < secondDays ? -1 : 1;
}

export function todayInBogota(now: Date = new Date()): IsoDate {
  return formatInTimeZone(now, TIME_ZONE, "yyyy-MM-dd");
}

export function monthKey(date: IsoDate): string {
  parseIsoDate(date);
  return date.slice(0, 7);
}
