import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TransactionForm } from "@/components/transaction-form";
import { todayInBogota } from "@/lib/domain/dates";
import { loadNewTransactionForm } from "@/lib/queries/transaction-form";
import { requireUser } from "@/lib/supabase/require-user";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ borrador?: string }> }): Promise<Metadata> {
  return { title: (await searchParams).borrador ? "Confirmar movimiento" : "Nuevo gasto" };
}

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ borrador?: string }> }) {
  const { borrador } = await searchParams;
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  // F18: confirming a captured draft opens this same form, prefilled. A draft that is no longer open goes back to the inbox.
  const form = await loadNewTransactionForm(supabase, user.id, today, borrador);
  if (!form) redirect("/por-confirmar");
  const { cards, categories, latestRate, existingCutoffs, merchantHistory, captured } = form;
  const header = captured ? <PageHeader title="Confirmar movimiento" subtitle="Revisa los datos de la alerta y completa lo que falte." /> : <PageHeader title="Nuevo gasto" subtitle="Registra un movimiento de tu tarjeta." />;
  return <div className="mx-auto flex w-full max-w-xl flex-col gap-6">{header}{cards.length ? <TransactionForm userId={user.id} cards={cards} categories={categories} today={today} latestRate={latestRate} existingCutoffs={existingCutoffs} merchantHistory={merchantHistory} captured={captured} /> : <EmptyState icon={CreditCard} text="Aún no tienes tarjetas. Agrega una para registrar movimientos." action={<Link href="/ajustes" className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ir a Ajustes</Link>} />}</div>;
}
