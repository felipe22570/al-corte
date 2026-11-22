import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { addDays, addMonths, todayInBogota } from "@/lib/domain/dates";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { loadMerchantHistory } from "../merchant-history";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("merchant history against local Supabase", () => {
  it("reads the latest purchase per merchant and card, only on active cards and within twelve months (R11, D53)", async () => {
    const userId = randomUUID();
    const activeId = randomUUID();
    const archivedId = randomUUID();
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
    const card = (id: string): TransactionCard => ({ id, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.2899", advanceRateEa: "0.2899", advanceFee: "15000", amortizationMethod: "fixed_principal", interestMode: "per_installment" });
    const today = todayInBogota();
    const base: TransactionPlanInput = { cardId: activeId, type: "purchase", date: addDays(today, -3), amount: "45000", currency: "COP", installmentsCount: 1, interestFree: false, categoryId: null, merchant: "Netflix", note: "" };
    async function create(input: Partial<TransactionPlanInput>) {
      const { error } = await client.rpc("create_transaction_with_installments", { p_payload: buildTransactionPlan({ ...base, ...input }, card(input.cardId ?? activeId)).payload });
      expect(error).toBeNull();
    }
    let created = false;
    try {
      sql(`insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,advance_rate_ea,advance_fee)
        values ('${activeId}','${userId}','Visa sintética','Bancolombia','Visa','1234',10000000,15,2,0.2899,0.2899,15000),
               ('${archivedId}','${userId}','Master archivada','Bancolombia','Mastercard','5678',10000000,15,2,0.2899,0.2899,15000);`);
      created = true;
      await create({ date: addDays(today, -40), installmentsCount: 3 });
      await create({ merchant: "NETFLIX" });
      await create({ merchant: "Viejo", date: addDays(addMonths(today, -12), -1) });
      await create({ merchant: "Archivada", cardId: archivedId });
      await create({ merchant: "", amount: "1000" });
      sql(`update public.cards set archived_at = now() where id = '${archivedId}';`);

      const history = await loadMerchantHistory(client as never, userId, today);
      expect(history.map((row) => [row.merchant, row.cardId, row.date, row.installmentsCount])).toEqual([["NETFLIX", activeId, addDays(today, -3), 1]]);
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}';`);
    }
  }, 20000);
});
