import type { CardColor } from "@/lib/card-colors";

export type CardRecord = {
  id: string; name: string; bank: string; network: string; last4: string;
  creditLimit: string; advanceFee: string; handlingFee: string;
  cutoffDay: number; paymentDay: number; purchaseRateEa: string; advanceRateEa: string;
  amortizationMethod: "fixed_principal" | "french"; color: CardColor; archivedAt: string | null;
};
export type CategoryRecord = { id: string; name: string; icon: string; archivedAt: string | null };
