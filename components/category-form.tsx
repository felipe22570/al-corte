"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { createCategory, updateCategory } from "@/lib/actions/categories";
import { CATEGORY_ICON_NAMES, categoryIconLabels, categoryIcons, type CategoryIcon } from "@/lib/category-icons";
import type { CategoryRecord } from "@/lib/settings-types";
import { categorySchema, type CategoryInput } from "@/lib/validation/category";

export function CategoryForm({ category }: { category?: CategoryRecord }) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState("");
  const [saved, setSaved] = useState(false);
  const form = useForm<CategoryInput>({ resolver: zodResolver(categorySchema, undefined, { raw: true }), defaultValues: { name: category?.name ?? "", icon: category?.icon ?? "ellipsis" } });
  const icon = useWatch({ control: form.control, name: "icon" }) as CategoryIcon;
  const Icon = Object.hasOwn(categoryIcons, icon) ? categoryIcons[icon] : categoryIcons.ellipsis;
  const onSubmit = form.handleSubmit(async (input) => {
    setServerError("");
    try {
      const result = category ? await updateCategory(category.id, input) : await createCategory(input);
      if (!result.ok) { setServerError(result.error); return; }
      setOpen(false); setSaved(true);
      if (!category) form.reset();
    } catch { setServerError("No pudimos guardar la categoría. Intenta de nuevo."); }
  });
  return <><Sheet title={category ? "Editar categoría" : "Agregar categoría"} open={open} onOpenChange={(nextOpen) => { if (nextOpen) { form.reset({ name: category?.name ?? "", icon: category?.icon ?? "ellipsis" }); setServerError(""); setSaved(false); } setOpen(nextOpen); }} trigger={<Button type="button" variant="outline">{category ? "Editar" : "Agregar categoría"}</Button>}>
    <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
      {serverError && <Alert variant="destructive"><AlertDescription>{serverError}</AlertDescription></Alert>}
      <div className="flex flex-col gap-2"><Label htmlFor="category-name">Nombre</Label><Input id="category-name" aria-invalid={!!form.formState.errors.name} aria-describedby={form.formState.errors.name ? "category-name-error" : undefined} {...form.register("name")} />{form.formState.errors.name?.message && <p id="category-name-error" role="alert" className="text-small text-danger">{form.formState.errors.name.message}</p>}</div>
      <div className="flex flex-col gap-2"><Label htmlFor="category-icon">Icono</Label><div className="flex items-center gap-3"><Icon className="size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" /><select id="category-icon" className="h-11 w-full rounded-md border border-input bg-card px-3 text-input text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" {...form.register("icon")}>{CATEGORY_ICON_NAMES.map((name) => <option key={name} value={name}>{categoryIconLabels[name]}</option>)}</select></div></div>
      <Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Guardando…" : "Guardar"}</Button>
    </form>
  </Sheet>{saved && <span role="status" className="text-small text-muted-foreground">Categoría guardada.</span>}</>;
}
