import Decimal from "decimal.js";
import { ChevronDown } from "lucide-react";

import { StatementConcept, type StatementConceptData } from "@/components/statement-concept";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";

export function StatementBreakdown({ concepts, payments }: { concepts: StatementConceptData[]; payments: StatementConceptData }) {
  const active = concepts.filter((concept) => concept.entries.length || !new Decimal(concept.total).isZero());
  const empty = concepts.filter((concept) => !concept.entries.length && new Decimal(concept.total).isZero());

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="statement-breakdown-title" className="flex flex-col gap-3">
        <h2 id="statement-breakdown-title" className="text-heading">Desglose</h2>
        {active.length > 0 && (
          <div className="divide-y divide-border border-y border-border">
            <div aria-hidden="true" className="flex justify-between gap-3 py-2 pl-8 text-small text-muted-foreground"><span>Concepto</span><span>Total</span></div>
            {active.map((concept) => <StatementConcept key={concept.key} concept={concept} />)}
          </div>
        )}
        {!active.length && <p className="text-small text-muted-foreground">No hay cargos en este extracto.</p>}
        {empty.length > 0 && (
          <Disclosure>
            <DisclosureSummary className="text-small text-muted-foreground">
              <span>{empty.length} {empty.length === 1 ? "concepto sin movimientos" : "conceptos sin movimientos"}</span>
              <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </DisclosureSummary>
            <DisclosureContent className="divide-y divide-border pt-0">
              {empty.map((concept) => <StatementConcept key={concept.key} concept={concept} />)}
            </DisclosureContent>
          </Disclosure>
        )}
      </section>
      <section aria-labelledby="statement-payments-title" className="flex flex-col gap-3">
        <h2 id="statement-payments-title" className="text-heading">Pagos</h2>
        <p className="text-small text-muted-foreground">Los pagos se muestran aparte y no cambian el total del extracto.</p>
        <div className="border-y border-border">
          <StatementConcept concept={payments} />
        </div>
      </section>
    </div>
  );
}
