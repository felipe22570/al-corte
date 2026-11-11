import { z } from "zod";

const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine((value) => Number(value.slice(0, 4)) >= 2 && Number(value.slice(0, 4)) <= 9998);
const idSchema = z.uuid();
const typeSchema = z.enum(["purchase", "cash_advance", "advance_fee", "payment", "handling_fee", "interest", "insurance", "refund", "adjustment"]);

export function parseHistoryFilters(params: Record<string, string | string[] | undefined>, currentMonth: string) {
  const text = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = typeof params.pagina === "string" && /^[1-9]\d{0,5}$/.test(params.pagina) ? Number(params.pagina) : 1;
  return {
    mes: monthSchema.safeParse(params.mes).success ? params.mes as string : currentMonth,
    tarjeta: idSchema.safeParse(params.tarjeta).success ? params.tarjeta as string : undefined,
    categoria: idSchema.safeParse(params.categoria).success ? params.categoria as string : undefined,
    tipo: typeSchema.safeParse(params.tipo).success ? params.tipo as z.infer<typeof typeSchema> : undefined,
    q: text || undefined,
    pagina: page,
  };
}
