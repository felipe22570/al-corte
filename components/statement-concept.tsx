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
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-body">
        <span className="min-w-0">{concept.label}</span>
        {amount}
      </div>
    );
  }

  return (
    <Disclosure>
      <DisclosureSummary className="px-4">
        <span className="min-w-0 flex-1">{concept.label}</span>
        {amount}
        <ChevronDown aria-hidden="true" className="size-5" strokeWidth={1.75} />
      </DisclosureSummary>
      <ul className="flex flex-col gap-2 px-4 pt-1 pb-3">
        {concept.entries.map((item) => (
          <li key={item.id}>
            <Link href={item.href} className="flex items-center justify-between gap-3 rounded-md text-small focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="min-w-0 break-words">{item.description}</span>
              <span className="shrink-0 text-right">
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
