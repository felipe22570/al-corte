import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/page-header";
import { TransactionDetailsForm } from "@/components/transaction-details-form";
import { TransactionForm } from "@/components/transaction-form";
import { todayInBogota } from "@/lib/domain/dates";
import { loadTransactionEditForm } from "@/lib/queries/transaction-form";
import { requireUser } from "@/lib/supabase/require-user";

export const metadata: Metadata = { title: "Editar movimiento" };

export default async function EditTransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, user } = await requireUser();
  const today = todayInBogota();
  const form = await loadTransactionEditForm(supabase, user.id, id, today);
  if (!form) notFound();
  if (form.mode === "details") {
    const reason = form.type === "payment"
      ? "Este pago cubre un extracto. Para cambiar su valor o su fecha, bórralo y regístralo de nuevo desde el extracto."
      : `${form.type === "cash_advance" ? "Este avance" : "Esta compra"} tiene abonos, saldos del banco o cambios de cuotas. Para cambiar su valor, deshazlos primero desde su detalle.`;
    return <div className="mx-auto flex w-full max-w-xl flex-col gap-6"><PageHeader title="Editar movimiento" subtitle="Solo puedes cambiar categoría, comercio y nota." /><TransactionDetailsForm id={id} categories={form.categories} reason={reason} initial={form.details} /></div>;
  }
  const { cards, categories, existingCutoffs, latestRate, cardArchived, categoryArchived, original, hasPaidInstallments, initial } = form;
  return <div className="mx-auto flex w-full max-w-xl flex-col gap-6"><PageHeader title="Editar movimiento" subtitle="Revisa los datos antes de guardar." />{cardArchived && <p className="text-body">La tarjeta original está archivada. Elige una tarjeta activa para continuar.</p>}{categoryArchived && <p className="text-body">La categoría original está archivada. Elige una categoría activa o Sin categoría antes de guardar.</p>}{cards.length ? <TransactionForm userId={user.id} cards={cards} categories={categories} today={today} latestRate={latestRate} existingCutoffs={existingCutoffs} edit={{ id, original, hasPaidInstallments, initial }} /> : <p className="text-body">Necesitas una tarjeta activa para editar este movimiento.</p>}</div>;
}
