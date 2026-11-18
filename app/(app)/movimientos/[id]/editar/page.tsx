import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { todayInBogota } from "@/lib/domain/dates";
import { loadRecentStatementCutoffs } from "@/lib/queries/statement-cutoffs";
import { createClient } from "@/lib/supabase/server";
import type { TransactionCardOption, TransactionCategoryOption } from "@/lib/transaction-options";
import { transactionTypeSchema } from "@/lib/validation/transaction";

export const metadata: Metadata = { title: "Editar movimiento" };
type RawCard = { id: string; name: string; last4: string; color: TransactionCardOption["color"]; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: TransactionCardOption["amortizationMethod"] };
type RawTransaction = { card_id: string; category_id: string | null; type: string; date: string; amount: string; currency: "COP" | "USD"; fx_rate: string | null; installments_count: number; interest_free: boolean; merchant: string | null; note: string | null; rate_ea_applied: string | null; parent_id: string | null; statement_id: string; prior_installments: number; original_installments_count: number | null };
type RawInstallment = { statement_id: string | null; number: number; balance_after: string };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [transactionResult, cardsResult, categoriesResult, installmentsResult] = await Promise.all([
    supabase.from("transactions").select("card_id,category_id,type,date,amount::text,currency,fx_rate::text,installments_count,interest_free,merchant,note,rate_ea_applied::text,parent_id,statement_id,prior_installments,original_installments_count").eq("id", id).eq("user_id", user.id).maybeSingle(),
    supabase.from("cards").select("id,name,last4,color,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("categories").select("id,name,icon").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("installments").select("statement_id,number,balance_after::text").eq("transaction_id", id).eq("user_id", user.id),
  ]);
  if (transactionResult.error || cardsResult.error || categoriesResult.error || installmentsResult.error) throw new Error("No pudimos cargar el movimiento.");
  if (!transactionResult.data) notFound();
  const transaction = transactionResult.data as unknown as RawTransaction;
  const type = transactionTypeSchema.safeParse(transaction.type);
  if (!type.success || (transaction.type === "advance_fee" && transaction.parent_id)) notFound();
  const installments = (installmentsResult.data ?? []) as unknown as RawInstallment[];
  const statementIds = installments.flatMap((row) => row.statement_id ? [row.statement_id] : []);
  const today = todayInBogota();
  const [paid, statementResult, existingCutoffs] = await Promise.all([
    statementIds.length ? supabase.from("statements").select("id", { count: "exact", head: true }).eq("user_id", user.id).in("id", statementIds).not("paid_at", "is", null) : Promise.resolve({ count: 0, error: null }),
    supabase.from("statements").select("cutoff_date").eq("id", transaction.statement_id).eq("user_id", user.id).single(),
    loadRecentStatementCutoffs(supabase, user.id, today),
  ]);
  if (paid.error || statementResult.error) throw new Error("No pudimos consultar los extractos del movimiento.");
  // An in-progress purchase is edited with the data copied from the bank (D49): k, the bank balance when it changed the plan, and the statement of k.
  const prior = transaction.prior_installments;
  const installmentK = installments.find((row) => row.number === prior + 1);
  const inProgress = prior > 0 ? {
    inProgress: true, currentInstallment: String(prior + 1), trackedFromCutoff: statementResult.data.cutoff_date,
    balanceAfter: transaction.original_installments_count !== null && installmentK ? installmentK.balance_after.replace(".", ",") : "",
  } : {};
  const cards: TransactionCardOption[] = ((cardsResult.data ?? []) as RawCard[]).map((card) => ({ id: card.id, name: card.name, last4: card.last4, color: card.color, cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea, advanceRateEa: card.advance_rate_ea, advanceFee: card.advance_fee, amortizationMethod: card.amortization_method }));
  const categories = (categoriesResult.data ?? []) as TransactionCategoryOption[];
  const categoryArchived = !!transaction.category_id && !categories.some((category) => category.id === transaction.category_id);
  if (categoryArchived) {
    const archived = await supabase.from("categories").select("id,name,icon").eq("id", transaction.category_id!).eq("user_id", user.id).maybeSingle();
    if (archived.error || !archived.data) throw new Error("No pudimos consultar la categoría del movimiento.");
    categories.push({ ...archived.data, name: `${archived.data.name} (archivada)` });
  }
  const cardArchived = !cards.some((card) => card.id === transaction.card_id);
  return <div className="mx-auto flex w-full max-w-xl flex-col gap-6"><PageHeader title="Editar movimiento" subtitle="Revisa los datos antes de guardar." />{cardArchived && <p className="text-body">La tarjeta original está archivada. Elige una tarjeta activa para continuar.</p>}{categoryArchived && <p className="text-body">La categoría original está archivada. Elige una categoría activa o Sin categoría antes de guardar.</p>}{cards.length ? <TransactionForm userId={user.id} cards={cards} categories={categories} today={today} latestRate={transaction.fx_rate} existingCutoffs={existingCutoffs} edit={{ id, original: { cardId: transaction.card_id, type: type.data, rateEaApplied: transaction.rate_ea_applied }, hasPaidInstallments: (paid.count ?? 0) > 0, initial: { cardId: cardArchived ? "" : transaction.card_id, type: type.data, date: transaction.date, amount: transaction.amount.replace(".", ","), currency: transaction.currency, fxRate: transaction.fx_rate?.replace(".", ",") ?? "", installmentsCount: String(transaction.original_installments_count ?? transaction.installments_count), interestFree: transaction.interest_free, categoryId: transaction.category_id ?? "", merchant: transaction.merchant ?? "", note: transaction.note ?? "", ...inProgress } }} /> : <p className="text-body">Necesitas una tarjeta activa para editar este movimiento.</p>}</div>;
}
