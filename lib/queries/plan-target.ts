import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import type { AmortizationMethod, InstallmentRow } from "@/lib/domain/installments";
import type { InterestMode } from "@/lib/domain/interest";
import type { Currency } from "@/lib/domain/money";
import type { PaymentTarget } from "@/lib/domain/payments";
import { monthlyRateFromEA } from "@/lib/domain/rates";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawTransaction = {
  id: string; card_id: string; statement_id: string; type: "purchase" | "cash_advance"; date: IsoDate; currency: Currency; amount: string; amount_cop: string; fx_rate: string | null;
  installments_count: number; interest_free: boolean; is_international: boolean; rate_ea_applied: string | null;
};
type RawRow = { statement_id: string | null; number: number; before_tracking: boolean; principal: string; interest: string; total: string; balance_after: string; principal_cop: string; interest_cop: string; total_cop: string };

export type PlanTargetContext = {
  target: PaymentTarget;
  cutoffDay: number;
  /** Monthly rate of the purchase, also for on-balance cards: it compares the estimated interest (D32). */
  interestRate: Decimal;
};

/** A purchase or advance in installments with its current plan and the prepayments, corrections and changes applied (F16). */
export async function loadPlanTarget(supabase: Client, userId: string, transactionId: string): Promise<PlanTargetContext | null> {
  const result = await supabase.from("transactions").select("id,card_id,statement_id,type,date,currency,amount::text,amount_cop::text,fx_rate::text,installments_count,interest_free,is_international,rate_ea_applied::text")
    .eq("id", transactionId).eq("user_id", userId).in("type", ["purchase", "cash_advance"]).gt("installments_count", 1).maybeSingle();
  if (result.error) throw new Error("No pudimos consultar la compra.");
  const raw = result.data as unknown as RawTransaction | null;
  if (!raw) return null;
  const [card, statements, rows, prepayments] = await Promise.all([
    supabase.from("cards").select("cutoff_day,interest_mode,amortization_method").eq("id", raw.card_id).eq("user_id", userId).single(),
    supabase.from("statements").select("id,cutoff_date").eq("card_id", raw.card_id).eq("user_id", userId),
    supabase.from("installments").select("statement_id,number,before_tracking,principal::text,interest::text,total::text,balance_after::text,principal_cop::text,interest_cop::text,total_cop::text").eq("transaction_id", raw.id).eq("user_id", userId).order("number"),
    supabase.from("principal_prepayments").select("amount::text,amount_cop::text").eq("transaction_id", raw.id).eq("user_id", userId),
  ]);
  if (card.error || statements.error || rows.error || prepayments.error) throw new Error("No pudimos consultar el plan de la compra.");
  const cardData = card.data as unknown as { cutoff_day: number; interest_mode: InterestMode; amortization_method: AmortizationMethod };
  const cutoffs = new Map(((statements.data ?? []) as Array<{ id: string; cutoff_date: IsoDate }>).map((item) => [item.id, item.cutoff_date]));
  const rate = raw.interest_free || raw.rate_ea_applied === null ? new Decimal(0) : monthlyRateFromEA(new Decimal(raw.rate_ea_applied));
  return {
    cutoffDay: cardData.cutoff_day, interestRate: rate,
    target: {
      id: raw.id, type: raw.type, date: raw.date, currency: raw.currency, installmentsCount: raw.installments_count, interestFree: raw.interest_free, isInternational: raw.is_international,
      statementCutoff: cutoffs.get(raw.statement_id)!,
      terms: { amount: new Decimal(raw.amount), amountCop: new Decimal(raw.amount_cop), currency: raw.currency, fxRate: raw.fx_rate === null ? null : new Decimal(raw.fx_rate),
        method: cardData.amortization_method, monthlyRate: cardData.interest_mode === "on_balance" ? new Decimal(0) : rate },
      rows: ((rows.data ?? []) as unknown as RawRow[]).map((row): InstallmentRow => ({
        number: row.number, principal: new Decimal(row.principal), interest: new Decimal(row.interest), total: new Decimal(row.total), balanceAfter: new Decimal(row.balance_after),
        cutoffDate: row.statement_id ? cutoffs.get(row.statement_id) ?? null : null, beforeTracking: row.before_tracking,
        principalCop: new Decimal(row.principal_cop), interestCop: new Decimal(row.interest_cop), totalCop: new Decimal(row.total_cop),
      })),
      prepayments: ((prepayments.data ?? []) as Array<{ amount: string; amount_cop: string }>).map((item) => ({ amount: new Decimal(item.amount), amountCop: new Decimal(item.amount_cop) })),
    },
  };
}
