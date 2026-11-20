import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { buildPaymentPlan, paymentPayload, type PaymentKind } from "@/lib/domain/payments";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import { loadPaymentContext } from "../payments";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("payments against local Supabase", () => {
  it("registers TypeScript payment plans through the RPC and undoes them last in, first out (R9)", async () => {
    const userId = randomUUID();
    const cardId = randomUUID();
    const sql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A"], { input, encoding: "utf8" });
    const envText = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" });
    const env = Object.fromEntries(envText.split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    if (!env.ANON_KEY || !env.JWT_SECRET) throw new Error("Falta configuración local de Supabase.");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const claims = Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const signature = createHmac("sha256", env.JWT_SECRET).update(`${header}.${claims}`).digest("base64url");
    const client = createClient("http://127.0.0.1:54321", env.ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${header}.${claims}.${signature}` } } });
    const card: TransactionCard = { id: cardId, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.2899", advanceRateEa: "0.2899", advanceFee: "0", amortizationMethod: "fixed_principal", interestMode: "per_installment" };
    const base: TransactionPlanInput = { cardId, type: "purchase", date: "2026-10-10", amount: "600000", currency: "COP", installmentsCount: 6, interestFree: false, categoryId: null, merchant: "Nevera", note: "" };
    async function create(input: Partial<TransactionPlanInput>) {
      const { error, data } = await client.rpc("create_transaction_with_installments", { p_payload: buildTransactionPlan({ ...base, ...input }, card).payload });
      expect(error).toBeNull();
      return String(data);
    }
    async function pay(kind: PaymentKind, currency: "COP" | "USD", amount?: string, effect: "reduce_term" | "reduce_installment" = "reduce_term") {
      const statementId = sql(`select id from public.statements where card_id = '${cardId}' and cutoff_date = '2026-11-15';`).trim();
      const context = (await loadPaymentContext(client as never, userId, statementId, currency))!;
      const plan = buildPaymentPlan({ kind, currency, date: "2026-11-18", statementCutoff: context.statement.cutoffDate, pending: context.pending, amount: amount ? new Decimal(amount) : undefined, targets: context.targets, rule: context.card.rule, effect });
      const { data, error } = await client.rpc("register_payment", { p_payload: paymentPayload({ cardId, statementId, currency, kind, date: "2026-11-18", fxRate: context.fxRate, note: "" }, plan) });
      expect(error).toBeNull();
      return { id: String(data), plan, context };
    }
    const installments = (id: string) => sql(`select count(*) || ':' || sum(principal) from public.installments where transaction_id = '${id}';`).trim();
    let created = false;
    try {
      sql(`
        insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,advance_rate_ea)
        values ('${cardId}','${userId}','Visa sintética','Bancolombia','Visa','1234',10000000,15,2,0.2899,0.2899);
        insert into public.fx_rates (date, usd_cop) values ('2026-11-18', 4000.5) on conflict (date) do nothing;
      `);
      created = true;
      const fridge = await create({});
      const single = await create({ date: "2026-11-17", amount: "50000", installmentsCount: 1, merchant: "Mercado" });
      const dollars = await create({ amount: "120", currency: "USD", fxRate: "4000", installmentsCount: 12, merchant: "Dólares" });
      expect(installments(fridge)).toBe("6:600000.00");

      // Otro valor: cubre el mínimo y abona primero a la compra de una cuota sin facturar, luego a la nevera.
      const other = await pay("other", "COP", "300000");
      expect(other.plan.prepayments.map((item) => item.transactionId)).toEqual([single, fridge]);
      expect(sql(`select single_purchases from public.statement_currency_totals st join public.statements s on s.id = st.statement_id where s.card_id = '${cardId}' and s.cutoff_date = '2026-12-15' and st.currency = 'COP';`).trim()).toBe("0.00");
      const prepaid = other.plan.prepayments.find((item) => item.transactionId === fridge)!;
      expect(installments(fridge).split(":")[1]).toBe(new Decimal(600000).minus(prepaid.amount).toFixed(2));
      expect(sql(`select paid_at is not null from public.statement_balances where currency = 'COP' and statement_id = (select id from public.statements where card_id = '${cardId}' and cutoff_date = '2026-11-15');`).trim()).toBe("t");

      // Total en dólares con la TRM de D4: liquida la compra en USD y no toca los pesos.
      const total = await pay("total", "USD");
      expect(total.context.fxRate?.toString()).toBe("4000.5");
      expect(total.plan.prepayments.map((item) => item.transactionId)).toEqual([dollars]);
      expect(installments(dollars)).toBe("2:20.00");
      expect(sql(`select (select sum(principal_cop) from public.installments where transaction_id = '${dollars}') + (select sum(amount_cop) from public.principal_prepayments where transaction_id = '${dollars}') = amount_cop from public.transactions where id = '${dollars}';`).trim()).toBe("t");

      // Reducir cuota sobre la nevera, después del primer abono.
      const second = await pay("other", "COP", "100000", "reduce_installment");
      expect(second.plan.prepayments.map((item) => item.transactionId)).toEqual([fridge]);
      expect(sql(`select count(*) from public.installments where transaction_id = '${fridge}';`).trim()).toBe(String(prepaid.rows!.length + prepaid.replacedFromNumber! - 1));

      // Deshacer en orden inverso devuelve el plan original.
      const blocked = await client.from("transactions").delete().eq("id", other.id);
      expect(blocked.error?.message).toContain("pago más reciente");
      for (const id of [second.id, total.id, other.id]) expect((await client.from("transactions").delete().eq("id", id)).error).toBeNull();
      expect(installments(fridge)).toBe("6:600000.00");
      expect(installments(dollars)).toBe("12:120.00");
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}'; delete from public.fx_rates where date = '2026-11-18' and usd_cop = 4000.5;`);
    }
  }, 20000);
});
