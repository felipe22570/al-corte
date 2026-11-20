import Decimal from "decimal.js";
import type { IsoDate } from "@/lib/domain/dates";
import type { BalanceInterestInstallment } from "@/lib/domain/interest";
import { fetchAllPages } from "@/lib/paginate";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;
type RawPrepayment = { transaction_id: string; payment_id: string; amount: string; amount_cop: string };
type RawPayment = { id: string; statement_id: string; date: IsoDate };
type RawPurchase = { id: string; date: IsoDate; rate_ea_applied: string | null; interest_free: boolean; currency: "COP" | "USD"; fx_rate: string | null; installments_count: number };
export type PrepaidAmount = { amount: Decimal; amountCop: Decimal };

function batches<T>(items: T[], size = 100): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

/** Prepayments received by each movement (R9), in its currency and its COP reference. */
export async function loadPrepaidAmounts(supabase: Client, userId: string, transactionIds: string[]): Promise<Map<string, PrepaidAmount>> {
  const result = new Map<string, PrepaidAmount>();
  const rows = (await Promise.all(batches([...new Set(transactionIds)]).map((ids) => fetchAllPages((from, to) =>
    supabase.from("principal_prepayments").select("transaction_id,payment_id,amount::text,amount_cop::text").eq("user_id", userId).in("transaction_id", ids).order("id").range(from, to))))).flat() as unknown as RawPrepayment[];
  for (const row of rows) {
    const current = result.get(row.transaction_id) ?? { amount: new Decimal(0), amountCop: new Decimal(0) };
    result.set(row.transaction_id, { amount: current.amount.plus(row.amount), amountCop: current.amountCop.plus(row.amount_cop) });
  }
  return result;
}

/**
 * A single-installment charge shows what is left after its prepayments (R9), as statement_currency_totals does.
 * Movements with installments count through their rows, which already reflect the prepayments.
 */
export function netOfPrepayments<T extends { id: string; installmentsCount?: number; amount?: Decimal; amountCop: Decimal }>(movements: T[], prepaid: Map<string, PrepaidAmount>): T[] {
  return movements.map((movement) => {
    const applied = (movement.installmentsCount ?? 1) === 1 ? prepaid.get(movement.id) : undefined;
    if (!applied) return movement;
    return { ...movement, amount: movement.amount?.minus(applied.amount), amountCop: movement.amountCop.minus(applied.amountCop) };
  });
}

/** A prepayment made in a statement period, as an on-balance interest basis still to be weighted by days (R9). */
export type PrepaymentBasis = { statementId: string; date: IsoDate; basis: BalanceInterestInstallment };

/**
 * Prepayments of payments registered in each statement (R1 by the payment date), for the on-balance estimate: the principal
 * was at the higher balance from the start of the period until the payment date. Single-installment charges never accrue it.
 */
export async function loadPrepaymentBases(supabase: Client, userId: string, statementIds: string[]): Promise<PrepaymentBasis[]> {
  if (!statementIds.length) return [];
  const payments = (await Promise.all(batches([...new Set(statementIds)]).map((ids) => fetchAllPages((from, to) =>
    supabase.from("transactions").select("id,statement_id,date").eq("user_id", userId).eq("type", "payment").in("statement_id", ids).order("id").range(from, to))))).flat() as unknown as RawPayment[];
  if (!payments.length) return [];
  const prepayments = (await Promise.all(batches(payments.map((payment) => payment.id)).map((ids) => fetchAllPages((from, to) =>
    supabase.from("principal_prepayments").select("transaction_id,payment_id,amount::text,amount_cop::text").eq("user_id", userId).in("payment_id", ids).order("id").range(from, to))))).flat() as unknown as RawPrepayment[];
  if (!prepayments.length) return [];
  const purchases = (await Promise.all(batches([...new Set(prepayments.map((item) => item.transaction_id))]).map((ids) => fetchAllPages((from, to) =>
    supabase.from("transactions").select("id,date,rate_ea_applied::text,interest_free,currency,fx_rate::text,installments_count").eq("user_id", userId).in("id", ids).order("id").range(from, to))))).flat() as unknown as RawPurchase[];
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const purchaseById = new Map(purchases.map((purchase) => [purchase.id, purchase]));
  return prepayments.flatMap((prepayment) => {
    const payment = paymentById.get(prepayment.payment_id)!;
    const purchase = purchaseById.get(prepayment.transaction_id);
    if (!purchase || purchase.installments_count === 1) return [];
    return [{ statementId: payment.statement_id, date: payment.date, basis: {
      principal: new Decimal(prepayment.amount), balanceAfter: new Decimal(0), purchaseDate: purchase.date,
      rateEa: purchase.rate_ea_applied === null ? null : new Decimal(purchase.rate_ea_applied), interestFree: purchase.interest_free,
      currency: purchase.currency, fxRate: purchase.fx_rate === null ? null : new Decimal(purchase.fx_rate),
    } }];
  });
}
