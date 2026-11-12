import Decimal from "decimal.js";
import { ChevronDown } from "lucide-react";

import { StatementConcept, type StatementConceptData } from "@/components/statement-concept";

export function StatementBreakdown({ concepts, payments }: { concepts: StatementConceptData[]; payments: StatementConceptData }) {
  const active = concepts.filter((concept) => concept.entries.length || !new Decimal(concept.total).isZero());
  const empty = concepts.filter((concept) => !concept.entries.length && new Decimal(concept.total).isZero());

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="statement-breakdown-title" className="flex flex-col gap-3">
        <h2 id="statement-breakdown-title" className="text-heading">Desglose</h2>
        {active.length > 0 && (
          <div className="divide-y divide-border rounded-xl border border-border bg-card">
            {active.map((concept) => <StatementConcept key={concept.key} concept={concept} />)}
          </div>
        )}
        {!active.length && <p className="text-small text-muted-foreground">No hay cargos en este extracto.</p>}
        {empty.length > 0 && (
          <details className="group rounded-xl border border-border bg-card">
            <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-2 text-small text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11 [&::-webkit-details-marker]:hidden">
              <span>{empty.length} {empty.length === 1 ? "concepto sin movimientos" : "conceptos sin movimientos"}</span>
              <ChevronDown aria-hidden="true" className="size-5 shrink-0 group-open:rotate-180" strokeWidth={1.75} />
            </summary>
            <div className="divide-y divide-border border-t border-border">
              {empty.map((concept) => <StatementConcept key={concept.key} concept={concept} />)}
            </div>
          </details>
        )}
      </section>
      <section aria-labelledby="statement-payments-title" className="flex flex-col gap-3">
        <h2 id="statement-payments-title" className="text-heading">Pagos</h2>
        <p className="text-small text-muted-foreground">Los pagos se muestran aparte y no cambian el total del extracto.</p>
        <div className="rounded-xl border border-border bg-card">
          <StatementConcept concept={payments} />
        </div>
      </section>
    </div>
  );
}
