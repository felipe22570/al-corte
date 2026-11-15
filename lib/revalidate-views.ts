import { revalidatePath } from "next/cache";

/**
 * Financial writes can affect multiple installments, historical comparisons,
 * projections and identities. Route patterns cover both previous and new
 * references without relying on Next.js's temporary router-cache behavior.
 */
export function revalidateFinancialViews() {
  revalidatePath("/");
  revalidatePath("/movimientos");
  revalidatePath("/movimientos/nuevo");
  revalidatePath("/suscripciones");
  revalidatePath("/ajustes");
  revalidatePath("/meses/[mes]", "page");
  revalidatePath("/movimientos/[id]", "page");
  revalidatePath("/movimientos/[id]/editar", "page");
  revalidatePath("/tarjetas/[id]", "page");
  revalidatePath("/tarjetas/[id]/extractos/[cutoff]", "page");
}
