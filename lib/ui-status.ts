export type StatusTone = "ok" | "warning" | "danger" | "neutral";

export function utilizationTone(percent: number): StatusTone {
  if (percent > 70) return "danger";
  return percent >= 30 ? "warning" : "ok";
}
