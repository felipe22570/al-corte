import { z } from "zod";
import { categoryIcons, type CategoryIcon } from "@/lib/category-icons";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Ingresa un nombre.").max(60, "Usa máximo 60 caracteres."),
  icon: z.string().refine((value): value is CategoryIcon => Object.hasOwn(categoryIcons, value), "Elige un icono de la lista."),
});
export type CategoryInput = z.input<typeof categorySchema>;
