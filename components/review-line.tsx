import type { ReactNode } from "react";
import { Money } from "@/components/money";
import type { Currency } from "@/lib/domain/money";

/**
 * One movement under review: name, details and amount on the right, with its state and controls below. Shared by the
 * monthly import (F22) and the "Por confirmar" inbox (F18).
 */
export function ReviewLine({ title, details, amount, currency, children }: { title: string; details: string; amount: string | null; currency: Currency | null; children?: ReactNode }) {
  return <li className="flex min-w-0 flex-col gap-1 border-t border-border pt-3 first:border-t-0 first:pt-0">
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
      <div className="min-w-0"><p className="text-body wrap-anywhere">{title}</p>{details && <p className="text-small text-muted-foreground">{details}</p>}</div>
      <span className="text-right">{amount && currency ? <Money value={amount} currency={currency} /> : <span className="text-small text-muted-foreground">Sin valor</span>}</span>
    </div>
    {children}
  </li>;
}
