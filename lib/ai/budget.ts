import "server-only";

import { fromZonedTime } from "date-fns-tz";

import { TIME_ZONE, todayInBogota } from "@/lib/domain/dates";

/** First instant of the current calendar month in Bogotá: the monthly AI budget restarts there. */
export function startOfBogotaMonth(now: Date): Date {
  return fromZonedTime(`${todayInBogota(now).slice(0, 7)}-01T00:00:00`, TIME_ZONE);
}
