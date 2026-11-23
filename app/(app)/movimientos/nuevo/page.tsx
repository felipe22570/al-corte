import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { draftFormStart } from "@/lib/draft-form";
import { todayInBogota } from "@/lib/domain/dates";
import { loadOpenDraft } from "@/lib/queries/drafts";
import { loadMerchantHistory } from "@/lib/queries/merchant-history";
import { loadRecentStatementCutoffs } from "@/lib/queries/statement-cutoffs";
import { createClient } from "@/lib/supabase/server";
import type { TransactionCardOption, TransactionCategoryOption } from "@/lib/transaction-options";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ borrador?: string }> }): Promise<Metadata> {
  return { title: (await searchParams).borrador ? "Confirmar movimiento" : "Nuevo gasto" };
}
const draftIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type RawCard = { id: string; name: string; last4: string; color: TransactionCardOption["color"]; cutoff_day: number; payment_day: number; purchase_rate_ea: string; advance_rate_ea: string; advance_fee: string; amortization_method: TransactionCardOption["amortizationMethod"]; interest_mode: "per_installment" | "on_balance"; usd_default_installments: number };

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ borrador?: string }> }) {
  const { borrador } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const today = todayInBogota();
  // F18: confirming a captured draft opens this same form, prefilled. A draft that is no longer open goes back to the inbox.
  const draft = borrador && draftIdPattern.test(borrador) ? await loadOpenDraft(supabase, user.id, borrador) : null;
  if (borrador && !draft) redirect("/por-confirmar");
  const [cardsResult, categoriesResult, ratesResult, existingCutoffs, merchantHistory] = await Promise.all([
    supabase.from("cards").select("id,name,last4,color,cutoff_day,payment_day,purchase_rate_ea::text,advance_rate_ea::text,advance_fee::text,amortization_method,interest_mode,usd_default_installments").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("categories").select("id,name,icon").eq("user_id", user.id).is("archived_at", null).order("name"),
    supabase.from("fx_rates").select("usd_cop::text").order("date", { ascending: false }).limit(1).maybeSingle(),
    loadRecentStatementCutoffs(supabase, user.id, today),
    loadMerchantHistory(supabase, user.id, today),
  ]);
  if (cardsResult.error || categoriesResult.error || ratesResult.error) throw new Error("No pudimos cargar los datos del movimiento.");
  let lastRate = (ratesResult.data as { usd_cop: string } | null)?.usd_cop ?? null;
  if (!lastRate) {
    const previous = await supabase.from("transactions").select("fx_rate::text").eq("user_id", user.id).eq("currency", "USD").not("fx_rate", "is", null).order("date", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (previous.error) throw new Error("No pudimos consultar la última TRM.");
    lastRate = (previous.data as { fx_rate: string } | null)?.fx_rate ?? null;
  }
  const cards: TransactionCardOption[] = ((cardsResult.data ?? []) as RawCard[]).map((card) => ({ id: card.id, name: card.name, last4: card.last4, color: card.color, cutoffDay: card.cutoff_day, paymentDay: card.payment_day, purchaseRateEa: card.purchase_rate_ea, advanceRateEa: card.advance_rate_ea, advanceFee: card.advance_fee, amortizationMethod: card.amortization_method, interestMode: card.interest_mode, usdDefaultInstallments: card.usd_default_installments }));
  const categories = (categoriesResult.data ?? []) as TransactionCategoryOption[];
  const captured = draft ? {
    id: draft.id,
    phrase: draft.phrase,
    last4: draft.last4,
    readByAi: draft.readByAi,
    billingCurrency: draft.suggestions?.billingCurrency && draft.suggestions.billingCurrency !== draft.currency ? draft.suggestions.billingCurrency : null,
    unknownCard: draft.status === "unknown_card" || !cards.some((card) => card.id === draft.cardId),
    ...draftFormStart({ cardId: draft.cardId, type: draft.type, amount: draft.amount, currency: draft.currency, merchantRaw: draft.merchantRaw, occurredOn: draft.occurredOn, suggestions: draft.suggestions },
      { cardIds: cards.map((card) => card.id), categoryIds: categories.map((category) => category.id), today, latestRate: lastRate }),
  } : undefined;
  const header = captured ? <PageHeader title="Confirmar movimiento" subtitle="Revisa los datos de la alerta y completa lo que falte." /> : <PageHeader title="Nuevo gasto" subtitle="Registra un movimiento de tu tarjeta." />;
  return <div className="mx-auto flex w-full max-w-xl flex-col gap-6">{header}{cards.length ? <TransactionForm userId={user.id} cards={cards} categories={categories} today={today} latestRate={lastRate} existingCutoffs={existingCutoffs} merchantHistory={merchantHistory} captured={captured} /> : <EmptyState icon={CreditCard} text="Aún no tienes tarjetas. Agrega una para registrar movimientos." action={<Link href="/ajustes" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ir a Ajustes</Link>} />}</div>;
}
