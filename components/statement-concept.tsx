import Decimal from "decimal.js";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { Money } from "@/components/money";
import { Disclosure, DisclosureSummary } from "@/components/ui/disclosure";

export type StatementConceptData = {
  key: string;
  label: string;
  total: string;
  subtract?: boolean;
  entries: {
    id: string;
    href: string;
    description: string;
    amountCop: string;
    amountUsd?: string;
  }[];
};

export function StatementConcept({ concept }: { concept: StatementConceptData }) {
  const amount = (
    <span className="shrink-0 text-right text-amount">
      {concept.subtract && !new Decimal(concept.total).isZero() && "−"}
      <Money value={concept.total} currency="COP" />
    </span>
  );

  if (!concept.entries.length) {
    return (
      <div className="flex items-center justify-between gap-3 py-3 pl-8 text-body">
        <span className="min-w-0 wrap-anywhere">{concept.label}</span>
        {amount}
      </div>
    );
  }

  return (
    <Disclosure>
      <DisclosureSummary className="py-3">
        <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
        <span className="min-w-0 flex-1 wrap-anywhere">{concept.label}</span>
        {amount}
      </DisclosureSummary>
      <ul className="flex flex-col gap-2 pb-3 pl-8">
        {concept.entries.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="flex min-h-10 min-w-0 flex-wrap items-center justify-between gap-3 rounded-md text-small underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11">
              <span className="min-w-0 flex-1 basis-48 wrap-anywhere">{item.description}</span>
              <span className="ml-auto min-w-0 max-w-full text-right">
                {item.amountUsd !== undefined && <><Money value={item.amountUsd} currency="USD" /><span className="block text-small text-muted-foreground">Estimado en pesos</span></>}
                <Money value={item.amountCop} currency="COP" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Disclosure>
  );
}
