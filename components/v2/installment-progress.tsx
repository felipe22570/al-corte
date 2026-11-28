import { Chip } from "./chip";
import { cx } from "./cx";

/** Progress of an installment plan: the current installment over the effective count, clamped to the plan. */
export function installmentProgress(current: number, count: number) {
  const total = Math.max(1, Math.floor(count));
  const at = Math.min(total, Math.max(1, Math.floor(current)));
  return { current: at, count: total, percent: Math.round((at / total) * 100), last: at === total };
}

/** "3 de 9" with a thin bar; the last installment says so (Tarjeta, Movimiento). */
export function InstallmentProgress({ current, count, showBar = true, className }: { current: number; count: number; showBar?: boolean; className?: string }) {
  const progress = installmentProgress(current, count);
  return <span className={cx("ui:inline-flex ui:flex-col ui:gap-1", className)}>
    <span className="ui:inline-flex ui:flex-wrap ui:items-center ui:gap-2 ui:tabular-nums">
      <span>{progress.current} de {progress.count}</span>
      {progress.last && <Chip variant="neutral">Última cuota</Chip>}
    </span>
    {showBar && <span role="img" aria-label={`Cuota ${progress.current} de ${progress.count}`} className="ui:block ui:h-1 ui:w-16 ui:overflow-hidden ui:rounded-bar ui:bg-track">
      <span className="ui:block ui:h-full ui:bg-text-2" style={{ width: `${progress.percent}%` }} />
    </span>}
  </span>;
}
