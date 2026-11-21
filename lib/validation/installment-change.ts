import { z } from "zod";
import { MAX_NEW_INSTALLMENTS } from "@/lib/domain/installments";

/** F16, D50: installments left after the change, 1 to 36 (the effective plan may reach 72). */
export const installmentChangeSchema = z.object({
  remaining: z.coerce.number({ error: `Elige entre 1 y ${MAX_NEW_INSTALLMENTS} cuotas restantes.` }).int(`Elige entre 1 y ${MAX_NEW_INSTALLMENTS} cuotas restantes.`)
    .min(1, `Elige entre 1 y ${MAX_NEW_INSTALLMENTS} cuotas restantes.`).max(MAX_NEW_INSTALLMENTS, `Elige entre 1 y ${MAX_NEW_INSTALLMENTS} cuotas restantes.`),
});
