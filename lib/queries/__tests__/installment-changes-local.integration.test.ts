import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { addMonths, todayInBogota } from "@/lib/domain/dates";
import { changeInstallments, installmentChangePayload } from "@/lib/domain/installment-changes";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { loadPlanTarget } from "../plan-target";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("installment changes and advance fees against local Supabase", () => {
  it("changes installments with the TypeScript plan, undoes it and keeps each advance's fee (F16, F17)", async () => {
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
    const card: TransactionCard = { id: cardId, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.2899", advanceRateEa: "0.2899", advanceFee: "15000", amortizationMethod: "fixed_principal", interestMode: "per_installment" };
    const today = todayInBogota();
    // Two months ago: one or two installments are billed today, depending on the day of the month.
    const base: TransactionPlanInput = { cardId, type: "purchase", date: addMonths(today, -2), amount: "1200000", currency: "COP", installmentsCount: 12, interestFree: false, categoryId: null, merchant: "Televisor", note: "" };
    async function create(input: Partial<TransactionPlanInput>) {
      const { error, data } = await client.rpc("create_transaction_with_installments", { p_payload: buildTransactionPlan({ ...base, ...input }, card).payload });
      expect(error).toBeNull();
      return String(data);
    }
    const plan = (id: string) => sql(`select count(*) || ':' || sum(principal) from public.installments where transaction_id = '${id}';`).trim();
    let created = false;
    try {
      sql(`insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,advance_rate_ea,advance_fee)
        values ('${cardId}','${userId}','Visa sintética','Bancolombia','Visa','1234',10000000,15,2,0.2899,0.2899,15000);`);
      created = true;
      const tv = await create({});
      const context = (await loadPlanTarget(client as never, userId, tv))!;
      const change = changeInstallments({ target: context.target, remaining: 24, date: today, cutoffDay: context.cutoffDay, interestRate: context.interestRate });
      const { error } = await client.rpc("change_installments", { p_payload: installmentChangePayload(tv, 24, change) });
      expect(error).toBeNull();
      expect(plan(tv)).toBe(`${change.effectivePlan}:1200000.00`);
      expect(change.interestDifference.isPositive()).toBe(true);
      const blocked = await client.rpc("update_transaction_with_installments", { p_id: tv, p_payload: buildTransactionPlan(base, card).payload });
      expect(blocked.error?.message).toContain("abonos a capital");
      expect((await client.from("principal_prepayments").delete().eq("transaction_id", tv)).error).toBeNull();
      expect(plan(tv)).toBe("12:1200000.00");

      // D41: an advance at another ATM keeps its fee, also when edited.
      const advance = await create({ type: "cash_advance", date: today, amount: "300000", installmentsCount: 1, merchant: "Avance", advanceFee: "7200.5" });
      const fee = () => sql(`select string_agg(amount::text, ',') from public.transactions where parent_id = '${advance}';`).trim();
      expect(fee()).toBe("7200.50");
      const edited = await client.rpc("update_transaction_with_installments", { p_id: advance, p_payload: buildTransactionPlan({ ...base, type: "cash_advance", date: today, amount: "300000", installmentsCount: 1, merchant: "Avance editado", advanceFee: "7200.5" }, card).payload });
      expect(edited.error).toBeNull();
      expect(fee()).toBe("7200.50");
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}';`);
    }
  }, 20000);
});
