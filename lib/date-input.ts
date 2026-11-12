import { isValidIsoDate } from "@/lib/domain/dates";

// Keep incomplete or impossible input intact so validation can explain it.
export function parseDateInput(value: string): string {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value) ?? /^(\d{2})(\d{2})(\d{4})$/.exec(value);
  if (!match) return value;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  return isValidIsoDate(iso) ? iso : value;
}
