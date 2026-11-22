import { z } from "zod";
import { isValidIsoDate } from "@/lib/domain/dates";

/** Largest monthly file accepted (F22): a statement fits in a few dozen KB. */
export const MAX_IMPORT_BYTES = 1024 * 1024;

const date = z.string().refine((value) => isValidIsoDate(value), "Fecha inválida");
const money = z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Valor inválido");
const rate = z.string().regex(/^\d{1,8}(\.\d{1,4})?$/, "Tasa inválida");
const currency = z.enum(["COP", "USD"]);
const key = z.string().min(1).max(100);

const card = z.object({
  key, last4: z.string().regex(/^\d{4}$/), name: z.string().max(100).optional(),
  cutoff_day: z.number().int().min(1).max(31), payment_day: z.number().int().min(1).max(31),
  purchase_rate_ea: z.string().max(20), advance_rate_ea: z.string().max(20),
  amortization_method: z.enum(["fixed_principal", "french"]), interest_mode: z.enum(["per_installment", "on_balance"]),
  bank_available_credit: money.optional(),
});
const balance = z.object({ currency, real_minimum: money.optional(), real_total: money.optional() });
const statement = z.object({ card: key, cutoff_date: date, due_date: date, reference_only: z.boolean().optional(), balances: z.array(balance).max(2) });
const transaction = z.object({
  key, card: key, type: z.enum(["purchase", "cash_advance", "advance_fee", "interest", "handling_fee", "insurance", "adjustment", "refund"]),
  date, merchant: z.string().max(200), category: z.string().max(100).nullable().optional(), amount: money, currency,
  installments_count: z.number().int().min(1).max(72), installments_count_original: z.number().int().min(1).max(36).optional(),
  current_installment: z.number().int().min(1).max(72).optional(), prior_installments: z.number().int().min(0).max(71).optional(),
  prior_principal_paid: money.optional(), installment_principal_this_statement: money.optional(), pending_principal_after_statement: money.optional(),
  interest_free: z.boolean().optional(), statement_cutoff: date, statement_override: z.boolean().nullable().optional(),
  note: z.string().max(1000).nullable().optional(), fx_rate: rate.nullable().optional(), parent: key.optional(),
});
const payment = z.object({ key, card: key, date, merchant: z.string().max(200), amount: money, currency, fx_rate: rate.nullable().optional(), applies_to_statement_cutoff: date });

/**
 * The `al-corte-import` v1 file as the monthly import reads it (docs/import-format.md). Subscriptions, reference statements,
 * anomalies and notes are ignored: subscriptions are managed in the app.
 */
export const monthlyFileSchema = z.object({
  format: z.literal("al-corte-import"), version: z.literal(1),
  cards: z.array(card).min(1).max(10), statements: z.array(statement).max(40), transactions: z.array(transaction).max(2000), payments: z.array(payment).max(200).default([]),
});
export type MonthlyFile = z.infer<typeof monthlyFileSchema>;
export type MonthlyTransaction = MonthlyFile["transactions"][number];

/** Reads and validates the file in memory. Errors never echo its content. */
export function parseMonthlyFile(text: string): { ok: true; file: MonthlyFile } | { ok: false; error: string } {
  if (new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) return { ok: false, error: "El archivo pesa más de 1 MB." };
  let json: unknown;
  try { json = JSON.parse(text); } catch { return { ok: false, error: "El archivo no es un JSON válido." }; }
  const parsed = monthlyFileSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.length ? ` (${issue.path.join(".")})` : "";
    const header = json as { format?: unknown; version?: unknown } | null;
    if (header?.format !== "al-corte-import" || header.version !== 1) return { ok: false, error: "El archivo no es al-corte-import v1." };
    return { ok: false, error: `El archivo no cumple el formato al-corte-import v1${where}.` };
  }
  const keys = parsed.data.transactions.map((item) => item.key).concat(parsed.data.payments.map((item) => item.key));
  if (new Set(keys).size !== keys.length) return { ok: false, error: "El archivo repite claves de movimientos." };
  return { ok: true, file: parsed.data };
}
