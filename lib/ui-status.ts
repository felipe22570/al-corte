export type StatusTone = "ok" | "warning" | "danger" | "neutral";

export function utilizationTone(percent: number): StatusTone {
  if (percent > 70) return "danger";
  return percent >= 30 ? "warning" : "ok";
}
export function dueTone(daysToDue: number, paid: boolean): StatusTone {
  if (paid) return "ok";
  if (daysToDue < 0) return "danger";
  return daysToDue <= 5 ? "warning" : "neutral";
}
export function trialTone(daysLeft: number): StatusTone {
  if (daysLeft < 0) return "neutral";
  return daysLeft <= 7 ? "warning" : "neutral";
}
