import Decimal from "decimal.js";
import { z } from "zod";
import { addDays, type IsoDate } from "@/lib/domain/dates";
import { trmForStatement, type FxRate } from "@/lib/domain/fx";
import { availableCredit } from "@/lib/domain/fx-difference";
import type { Currency } from "@/lib/domain/money";
import { loadImportContext } from "@/lib/queries/import-context";
import type { createClient } from "@/lib/supabase/server";
import { parseMonthlyFile } from "./monthly-file";
import { buildImportRequest, buildMonthlyReview, defaultDecisions, type ImportDecision, type ImportReview } from "./monthly-review";

type Client = Awaited<ReturnType<typeof createClient>>;
/** Calculated values of a statement and currency after the import, next to the bank values already stored. */
export type ImportVerification = {
  cardId: string; cutoffDate: IsoDate; currency: Currency; minimum: string; debt: string; realMinimum: string | null; realTotal: string | null; available: string | null;
  /** D52: TRM of the statement (last business day before its cutoff) used for the credit, when it values a debt in dollars. */
  trm: string | null; usdNet: string;
};
export type ImportRunResult =
  | { ok: true; review: ImportReview; decisions: Record<string, ImportDecision>; verification: ImportVerification[]; created: number; linked: number; dryRun: boolean }
  | { ok: false; error: string };

const decisionsSchema = z.record(z.string().min(1).max(100), z.enum(["import", "link", "skip"])).optional();
type RawResult = { created: number; linked: number; statements: Array<{ card_id: string; cutoff_date: IsoDate; currency: Currency; minimum: string; debt: string; real_minimum: string | null; real_total: string | null; available: string | null; credit_limit: string | null; cop_used: string | null; usd_net: string | null }> };

/**
 * Reviews (preview with `dryRun`) or saves a monthly file (F22). The file is read in memory and never stored nor logged
 * (D55). The preview and the save run the same RPC, so the verification before and after uses the same code.
 */
export async function runMonthlyImport(supabase: Client, userId: string, text: string, rawDecisions: unknown, dryRun: boolean): Promise<ImportRunResult> {
  const parsed = parseMonthlyFile(text);
  if (!parsed.ok) return parsed;
  const decisions = decisionsSchema.safeParse(rawDecisions);
  if (!decisions.success) return { ok: false, error: "Las decisiones de la revisión no son válidas." };
  const built = buildMonthlyReview(parsed.file, await loadImportContext(supabase, userId, parsed.file));
  if (!built.ok) return built;
  const chosen = { ...defaultDecisions(built.review), ...decisions.data };
  const request = buildImportRequest(built.review, built.plans, chosen);
  const { data, error } = await supabase.rpc("import_statement_file", { p_payload: request, p_dry_run: dryRun });
  if (error || !data) {
    const key = error?.message.split(":")[0];
    const row = built.review.rows.find((item) => item.key === key);
    return { ok: false, error: row ? `No pudimos importar ${row.merchant || "un movimiento"} del ${row.date}: ${error!.message.slice(key!.length + 1).trim()}` : "No pudimos importar el extracto. No se guardó nada." };
  }
  const result = data as unknown as RawResult;
  // D52: against a statement the dollars are valued with the TRM in force the last business day before its cutoff.
  const cutoffs = [...new Set(result.statements.map((item) => item.cutoff_date))].sort();
  const ratesResult = cutoffs.length ? await supabase.from("fx_rates").select("date,usd_cop::text,valid_from").gte("date", addDays(cutoffs[0]!, -12)).lte("date", cutoffs.at(-1)!) : { data: [], error: null };
  const rates: FxRate[] = ((ratesResult.data ?? []) as Array<{ date: IsoDate; usd_cop: string; valid_from: IsoDate }>).map((item) => ({ date: item.date, usdCop: item.usd_cop, validFrom: item.valid_from }));
  const valued = (item: RawResult["statements"][number]) => {
    const usdNet = item.usd_net ?? "0";
    const trm = new Decimal(usdNet).isZero() ? null : trmForStatement(rates, item.cutoff_date);
    const available = trm && item.credit_limit && item.cop_used
      ? availableCredit({ creditLimit: new Decimal(item.credit_limit), copUsed: new Decimal(item.cop_used), usdNet: new Decimal(usdNet), trm: new Decimal(trm) }).toFixed()
      : item.available;
    return { trm, usdNet, available };
  };
  return {
    ok: true, review: built.review, decisions: chosen, created: result.created, linked: result.linked, dryRun,
    verification: result.statements.map((item) => ({ cardId: item.card_id, cutoffDate: item.cutoff_date, currency: item.currency, minimum: item.minimum, debt: item.debt, realMinimum: item.real_minimum, realTotal: item.real_total, ...valued(item) })),
  };
}
