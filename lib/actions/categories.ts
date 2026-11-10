"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation/category";

export async function createCategory(input: unknown) {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa el nombre y el icono.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { error } = await supabase.from("categories").insert({ ...parsed.data, user_id: user.id });
  if (error) return { ok: false as const, error: error.code === "23505" ? "Ya tienes una categoría con ese nombre." : "No pudimos guardar la categoría." };
  revalidatePath("/ajustes");
  return { ok: true as const };
}

export async function updateCategory(id: string, input: unknown) {
  if (!z.uuid().safeParse(id).success) return { ok: false as const, error: "La categoría no es válida." };
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa el nombre y el icono.", errors: z.flattenError(parsed.error).fieldErrors };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { data, error } = await supabase.from("categories").update(parsed.data).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: error?.code === "23505" ? "Ya tienes una categoría con ese nombre." : "No pudimos actualizar la categoría." };
  revalidatePath("/ajustes");
  return { ok: true as const };
}

export async function archiveCategory(id: string) {
  if (!z.uuid().safeParse(id).success) return { ok: false as const, error: "La categoría no es válida." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Inicia sesión para continuar." };
  const { data, error } = await supabase.from("categories").update({ archived_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "No pudimos archivar la categoría." };
  revalidatePath("/ajustes");
  return { ok: true as const };
}
