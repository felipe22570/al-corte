import type { CardColor } from "@/lib/card-colors";
import type { TransactionCard } from "@/lib/domain/transaction-plan";

/** `usdDefaultInstallments` preloads the installments when the currency changes to USD (D34). */
export type TransactionCardOption = TransactionCard & { name: string; last4: string; color: CardColor; usdDefaultInstallments?: number };
export type TransactionCategoryOption = { id: string; name: string; icon: string };
