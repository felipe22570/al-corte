"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import type { z } from "zod";
import { SelectControl } from "@/components/select-control";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTransactionDetails } from "@/lib/actions/transactions";
import type { TransactionCategoryOption } from "@/lib/transaction-options";
import { transactionDetailsSchema } from "@/lib/validation/transaction";

type DetailsInput = z.input<typeof transactionDetailsSchema>;

/** Edits category, merchant and note of a movement whose amounts are fixed by prepayments or a typed payment (R9). */
export function TransactionDetailsForm({ id, categories, initial, reason }: { id: string; categories: TransactionCategoryOption[]; initial: DetailsInput; reason: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState("");
  const form = useForm<DetailsInput>({ resolver: zodResolver(transactionDetailsSchema, undefined, { raw: true }), defaultValues: initial });
  const error = (field: keyof DetailsInput) => form.formState.errors[field]?.message;
  const onSubmit = form.handleSubmit(async (input) => {
    setServerError("");
    try {
      const result = await updateTransactionDetails(id, input);
      if (!result.ok) { setServerError(result.error); return; }
      router.push(`/movimientos/${id}?notice=updated`);
      router.refresh();
    } catch { setServerError("No pudimos actualizar el movimiento. Revisa tu conexión e intenta de nuevo."); }
  });
  return <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
    <Alert variant="warning"><AlertDescription>{reason}</AlertDescription></Alert>
    {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
    <div className="flex flex-col gap-2"><Label htmlFor="details-category">Categoría</Label><Controller control={form.control} name="categoryId" render={({ field: { onChange, ...field } }) => <SelectControl {...field} value={field.value ?? ""} id="details-category" onValueChange={onChange} options={[{ value: "", label: "Sin categoría" }, ...categories.map((category) => ({ value: category.id, label: category.name }))]} />} /></div>
    <div className="flex flex-col gap-2"><Label htmlFor="details-merchant">Comercio</Label><Input id="details-merchant" autoComplete="off" aria-invalid={!!error("merchant")} aria-describedby={error("merchant") ? "details-merchant-error" : undefined} {...form.register("merchant")} />{error("merchant") && <p id="details-merchant-error" role="alert" className="text-small text-danger">{error("merchant")}</p>}</div>
    <div className="flex flex-col gap-2"><Label htmlFor="details-note">Nota</Label><textarea id="details-note" rows={3} className="w-full rounded-md border border-input bg-card p-3 text-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-invalid={!!error("note")} aria-describedby={error("note") ? "details-note-error" : undefined} {...form.register("note")} />{error("note") && <p id="details-note-error" role="alert" className="text-small text-danger">{error("note")}</p>}</div>
    <div className="flex flex-wrap gap-3"><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button><Button type="button" variant="outline" onClick={() => router.push(`/movimientos/${id}`)}>Cancelar</Button></div>
  </form>;
}
