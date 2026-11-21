"use client";

import { StatementPaymentControl } from "@/components/statement-payment-control";
import { StatementPaymentForm } from "@/components/statement-payment-form";
import type { Currency } from "@/lib/domain/money";

/** Payment controls of one currency of a statement (D33, D37); secondary controls with unique IDs. Bank values live in the close (D39). */
export function StatementBalanceControls({ id, currency, paid, today, context, closed = false }: {
  id: string; currency: Currency; paid: boolean; today: string; context: string;
  /** Payments are registered for statements already cut (D37). */
  closed?: boolean;
}) {
  return <div className="grid gap-4">
    {closed && <StatementPaymentForm statementId={id} currency={currency} today={today} context={context} />}
    <StatementPaymentControl id={id} paid={paid} today={today} context={context} currency={currency} />
  </div>;
}
