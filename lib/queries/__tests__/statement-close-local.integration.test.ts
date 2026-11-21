import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { planBalanceCorrections } from "@/lib/domain/reconciliation";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { loadMonthOverview } from "../months";
import { loadCloseContext } from "../statement-close";
import { createSupabaseMonthSource } from "../supabase-months";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("statement close against local Supabase", () => {
  it("applies TypeScript balance corrections through the RPC and reflects the close in reads (D39)", async () => {
    const userId = randomUUID();
    const cardId = randomUUID();
    const sql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A"], { input, encoding: "utf8" });
    const env = Object.fromEntries(execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" }).split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    if (!env.ANON_KEY || !env.JWT_SECRET) throw new Error("Falta configuración local de Supabase.");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const signature = createHmac("sha256", env.JWT_SECRET).update(`${header}.${claims}`).digest("base64url");
    const client = createClient("http://127.0.0.1:54321", env.ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${header}.${claims}.${signature}` } } });
    const card: TransactionCard = { id: cardId, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.2899", advanceRateEa: "0.2899", advanceFee: "0", amortizationMethod: "fixed_principal", interestMode: "on_balance" };
    const base: TransactionPlanInput = { cardId, type: "purchase", date: "2026-10-10", amount: "600000", currency: "COP", installmentsCount: 6, interestFree: false, categoryId: null, merchant: "Nevera", note: "" };
    async function create(input: Partial<TransactionPlanInput>) {
      const { error, data } = await client.rpc("create_transaction_with_installments", { p_payload: buildTransactionPlan({ ...base, ...input }, card).payload });
      expect(error).toBeNull();
      return String(data);
    }
    const statementId = () => sql(`select id from public.statements where card_id = '${cardId}' and cutoff_date = '2026-11-15';`).trim();
    async function close(currency: "COP" | "USD", balances: Record<string, string | null>, extra: Record<string, unknown> = {}) {
      const context = (await loadCloseContext(client as never, userId, statementId(), currency))!;
      const planned = planBalanceCorrections({ purchases: context.purchases, entered: new Map(Object.entries(balances).map(([id, value]) => [id, value === null ? null : new Decimal(value)])),
        statementCutoff: context.statement.cutoffDate, cutoffDay: context.card.cutoffDay });
      const { error } = await client.rpc("close_statement", { p_payload: { statement_id: context.statement.id, currency, corrections: planned.corrections, remove_corrections: planned.remove,
        fx_rate: context.fxRate?.toFixed() ?? null, ...extra } });
      expect(error).toBeNull();
      return context;
    }
    const plan = (id: string) => sql(`select count(*) || ':' || sum(principal) from public.installments where transaction_id = '${id}';`).trim();
    let created = false;
    try {
      sql(`
        insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,advance_rate_ea,interest_mode)
        values ('${cardId}','${userId}','Visa sintética','Bancolombia','Visa','1234',10000000,15,2,0.2899,0.2899,'on_balance');
        insert into public.fx_rates (date, usd_cop) values ('2026-11-18', 4000.5) on conflict (date) do nothing;
      `);
      created = true;
      const fridge = await create({});
      const advance = await create({ type: "cash_advance", date: "2026-04-16", installmentsCount: 24, merchant: "Avance" });
      const dollars = await create({ amount: "120", currency: "USD", fxRate: "4000", installmentsCount: 12, merchant: "Dólares" });

      const before = await loadCloseContext(client as never, userId, statementId(), "COP");
      expect(before!.purchases.map((purchase) => [purchase.id, purchase.calculated.toString()])).toEqual([[advance, "425000"], [fridge, "400000"]]);
      expect(before!.calculated.estimated).toBe(true);

      // Saldo del avance menor (18 cuotas efectivas) y de la nevera mayor (7 cuotas); intereses reales y conciliación.
      await close("COP", { [advance]: "269998.46", [fridge]: "450000" }, { interest: "20000", late_interest: "1500", real_minimum: "146500", real_total: "866498.46", reconcile: true });
      expect(plan(advance)).toBe("18:444998.46");
      expect(plan(fridge)).toBe("7:650000.00");
      const after = (await loadCloseContext(client as never, userId, statementId(), "COP"))!;
      expect(after.bank).toMatchObject({ reconciledAt: expect.any(String) });
      expect(after.bank.interest?.toString()).toBe("20000");
      expect(after.calculated.estimated).toBe(false);
      expect(after.calculated.debt.toString()).toBe("866498.46");
      expect(after.purchases.map((purchase) => [purchase.calculated.toString(), purchase.bankBalance?.toString()])).toEqual([["425000", "269998.46"], ["400000", "450000"]]);

      // En dólares: el saldo del banco liquida la compra; el equivalente en pesos cuadra.
      await close("USD", { [dollars]: "0" }, { reconcile: true });
      expect(plan(dollars)).toBe("2:20.00");
      expect(sql(`select (select sum(principal_cop) from public.installments where transaction_id = '${dollars}') + (select sum(amount_cop) from public.principal_prepayments where transaction_id = '${dollars}') = amount_cop from public.transactions where id = '${dollars}';`).trim()).toBe("t");

      // Lecturas: la conciliación quita el aviso y el interés estimado en pesos.
      const overview = await loadMonthOverview(createSupabaseMonthSource(client as never, userId), "2026-11-21");
      expect(overview.toReview).toEqual([]);
      const december = [overview.current, ...overview.future].find((month) => month.month === "2026-12")!;
      expect(december.statements.flatMap((statement) => statement.charges ?? []).filter((charge) => charge.estimated && (charge.currency ?? "COP") === "COP")).toEqual([]);

      // Vaciar el saldo restaura el plan; reabrir conserva los valores.
      await close("COP", { [fridge]: null });
      expect(plan(fridge)).toBe("6:600000.00");
      expect((await client.rpc("reopen_statement", { p_statement_id: statementId(), p_currency: "COP" })).error).toBeNull();
      const reopened = await loadMonthOverview(createSupabaseMonthSource(client as never, userId), "2026-11-21");
      expect(reopened.toReview.map((review) => review.cutoffDate)).toEqual(["2026-11-15"]);
      expect(sql(`select real_minimum from public.statement_balances where statement_id = '${statementId()}' and currency = 'COP';`).trim()).toBe("146500.00");
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}'; delete from public.fx_rates where date = '2026-11-18' and usd_cop = 4000.5;`);
    }
  }, 20000);
});
