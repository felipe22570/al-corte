import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { addMonths, todayInBogota } from "@/lib/domain/dates";
import { payInFullSavings } from "@/lib/domain/deferral-cost";
import { lastClosedCutoff } from "@/lib/domain/statements";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { loadPayInFullSavings } from "../pay-in-full-savings";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("pay-in-full savings against local Supabase", () => {
  it("reads future installments and matches the domain estimate for the statement (R11, D54)", async () => {
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
    const card: TransactionCard = { id: cardId, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.283288", advanceRateEa: "0.283288", advanceFee: "0", amortizationMethod: "fixed_principal", interestMode: "on_balance" };
    const today = todayInBogota();
    const cutoff = lastClosedCutoff(15, today);
    const base: TransactionPlanInput = { cardId, type: "purchase", date: addMonths(today, -3), amount: "1200000", currency: "COP", installmentsCount: 12, interestFree: false, categoryId: null, merchant: "Televisor", note: "" };
    let created = false;
    try {
      sql(`insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,advance_rate_ea,advance_fee,interest_mode)
        values ('${cardId}','${userId}','Visa sintética','Bancolombia','Visa','1234',10000000,15,2,0.283288,0.283288,0,'on_balance');`);
      created = true;
      const tv = buildTransactionPlan(base, card);
      const later = buildTransactionPlan({ ...base, date: today, merchant: "Después del corte" }, card);
      for (const plan of [tv, later]) expect((await client.rpc("create_transaction_with_installments", { p_payload: plan.payload })).error).toBeNull();
      const statementId = sql(`select id from public.statements where card_id = '${cardId}' and cutoff_date = '${cutoff}';`).trim();

      const savings = await loadPayInFullSavings(client as never, userId, [{ id: statementId, cardId, cutoffDate: cutoff, currencies: ["COP", "USD"] }], today);
      const expected = payInFullSavings([tv.deferral, later.deferral], { currency: "COP", statementCutoff: cutoff, today });
      expect(expected.gt(0)).toBe(true);
      expect(savings.get(statementId)?.COP?.toFixed(2)).toBe(expected.toFixed(2));
      expect(savings.get(statementId)?.USD?.isZero()).toBe(true);
      expect((await loadPayInFullSavings(client as never, userId, [], today)).size).toBe(0);
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}';`);
    }
  }, 20000);
});
