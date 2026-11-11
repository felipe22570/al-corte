import type { CardColor } from "@/lib/card-colors";

export type SubscriptionCard = { id: string; name: string; last4: string; color: CardColor };
export type SubscriptionCategory = { id: string; name: string };
export type SubscriptionRecord = { id: string; name: string; cardId: string; categoryId: string | null; amount: string; currency: "COP" | "USD"; frequency: "monthly" | "yearly"; billingDay: number; startDate: string; trialEndsAt: string | null; status: "active" | "paused" | "cancelled" };
