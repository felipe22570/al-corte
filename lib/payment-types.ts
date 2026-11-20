import type { Currency } from "@/lib/domain/money";
import type { AllocationRule, PaymentKind, PrepaymentEffect } from "@/lib/domain/payments";

/** A movement that can receive the prepayment, as shown in the payment form. Amounts are decimal strings. */
export type PaymentCandidateView = { id: string; label: string; detail: string; pending: string };

/** A prepayment of the plan and its effect on the movement (R9). */
export type PaymentPrepaymentView = {
  transactionId: string; amount: string; assumed: boolean;
  /** Unbilled installments left after the prepayment; 0 when it settles the movement. Null for single-installment charges. */
  remainingInstallments: number | null;
  /** Next installment after the prepayment, when installments remain. */
  nextInstallment: string | null;
};

/** Preview of a payment (F14): what covers the minimum, what is a prepayment and how it is distributed (D37, D38). */
export type PaymentPreview = {
  kind: PaymentKind; currency: Currency; rule: AllocationRule; effect: PrepaymentEffect;
  amount: string; pending: string; minimumAmount: string | null; totalAmount: string | null;
  toMinimum: string; coversMinimum: boolean; prepayable: string; allocatable: string; leftover: string;
  candidates: PaymentCandidateView[];
  prepayments: PaymentPrepaymentView[];
};
