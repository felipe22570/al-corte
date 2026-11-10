import { todayInBogota, type IsoDate } from "@/lib/domain/dates";
import { formatDateShort, formatDateWithWeekday } from "@/lib/format";

export function DateLabel({ date, weekday = false }: { date: IsoDate; weekday?: boolean }) {
  const today = todayInBogota();
  return <time dateTime={date}>{weekday ? formatDateWithWeekday(date, today) : formatDateShort(date, today)}</time>;
}
