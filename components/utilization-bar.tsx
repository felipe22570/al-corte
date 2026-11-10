import { utilizationTone } from "@/lib/ui-status";

const colors = { ok: "bg-primary", warning: "bg-warning", danger: "bg-danger", neutral: "bg-secondary" };
export function UtilizationBar({ percent }: { percent: number }) {
  const tone = utilizationTone(percent);
  return <div className="space-y-2"><span className="text-small">{Math.round(percent)}% de utilización</span><div role="progressbar" aria-label="Utilización" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, percent))} className="h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${colors[tone]}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div></div>;
}
