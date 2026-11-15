export default function MonthsLoading() {
  return (
    <div role="status" aria-label="Cargando meses" className="grid gap-6 motion-safe:animate-pulse">
      <div className="grid gap-2">
        <div className="h-8 w-32 rounded-md bg-secondary" />
        <div className="h-4 w-64 max-w-full rounded-md bg-secondary" />
      </div>
      <div className="grid gap-3">
        <div className="h-5 w-24 rounded-md bg-secondary" />
        <div className="h-48 rounded-xl border border-border bg-card" />
      </div>
      <div className="h-32 rounded-xl border border-border bg-card" />
      <div className="grid gap-3">
        <div className="h-5 w-36 rounded-md bg-secondary" />
        <div className="h-32 rounded-xl border border-border bg-card" />
        <div className="h-32 rounded-xl border border-border bg-card" />
      </div>
    </div>
  );
}
