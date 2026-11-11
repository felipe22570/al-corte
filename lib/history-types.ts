import type { CardColor } from "@/lib/card-colors";
import type { Currency } from "@/lib/domain/money";

export type HistoryCard = { id: string; name: string; last4: string; color: CardColor };
export type HistoryCategory = { id: string; name: string; icon: string | null };
export type HistoryRow = { id: string; date: string; merchant: string | null; note: string | null; type: string; amount: string; amount_cop: string; currency: Currency; card_id: string; category_id: string | null; installments_count: number };
export const historyTypeLabels: Record<string, string> = { purchase: "Compra", cash_advance: "Avance", advance_fee: "Comisión por avance", payment: "Pago", handling_fee: "Cuota de manejo", interest: "Interés", insurance: "Seguro", refund: "Devolución", adjustment: "Ajuste" };
