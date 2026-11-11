import type { CardColor } from "@/lib/card-colors";
import type { TransactionCard } from "@/lib/domain/transaction-plan";

export type TransactionCardOption = TransactionCard & { name: string; last4: string; color: CardColor };
export type TransactionCategoryOption = { id: string; name: string; icon: string };
