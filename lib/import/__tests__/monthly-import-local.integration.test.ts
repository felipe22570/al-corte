import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { buildTransactionPlan, type TransactionCard, type TransactionPlanInput } from "@/lib/domain/transaction-plan";
import type { MonthlyFile } from "../monthly-file";
import { runMonthlyImport } from "../run-monthly-import";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";
const base = { card: "visa", category: null, currency: "COP" as const, installments_count: 1, statement_cutoff: "2026-11-15" };
const monthlyFile = (transactions: MonthlyFile["transactions"], payments: MonthlyFile["payments"] = []): MonthlyFile => ({
  format: "al-corte-import", version: 1,
  cards: [{ key: "visa", last4: "7777", cutoff_day: 15, payment_day: 2, purchase_rate_ea: "0.283288", advance_rate_ea: "0.283288", amortization_method: "fixed_principal", interest_mode: "on_balance", bank_available_credit: "9000000.00" }],
  statements: [{ card: "visa", cutoff_date: "2026-11-15", due_date: "2026-12-02", balances: [{ currency: "COP", real_minimum: "400000.00", real_total: "900000.00" }] }],
  transactions, payments,
});
const november = monthlyFile([
  { ...base, key: "t-mercado", type: "purchase", date: "2026-11-03", merchant: "MERCADO", amount: "25000" },
  { ...base, key: "t-tienda", type: "purchase", date: "2026-11-04", merchant: "Tienda B", amount: "30000" },
  { ...base, key: "t-netflix", type: "purchase", date: "2026-11-07", merchant: "DLO*NETFLIX", amount: "44900" },
  { ...base, key: "t-directv", type: "purchase", date: "2026-11-04", merchant: "DIRECTV", amount: "140910" },
  { ...base, key: "t-manejo", type: "handling_fee", date: "2026-11-15", merchant: "Cuota de manejo", amount: "25000" },
  { ...base, key: "t-interes", type: "interest", date: "2026-11-15", merchant: "Intereses", amount: "12000" },
  { ...base, key: "t-nevera", type: "purchase", date: "2026-08-10", merchant: "Nevera", amount: "600000", installments_count: 6, installments_count_original: 6,
    current_installment: 4, prior_installments: 3, prior_principal_paid: "300000", installment_principal_this_statement: "100000", pending_principal_after_statement: "200000" },
  { ...base, key: "t-nueva", type: "purchase", date: "2026-11-10", merchant: "Librería", amount: "80000" },
], [{ key: "p-nov", card: "visa", date: "2026-11-30", merchant: "Pago", amount: "400000", currency: "COP", applies_to_statement_cutoff: "2026-11-15" }]);

describe.skipIf(!enabled)("monthly statement import against local Supabase", () => {
  it("reviews, saves only additions and recognizes the same file and the next month (F22, D55)", async () => {
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
    const card: TransactionCard = { id: cardId, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.283288", advanceRateEa: "0.283288", advanceFee: "6840", amortizationMethod: "fixed_principal", interestMode: "on_balance" };
    const purchase = { cardId, type: "purchase", installmentsCount: 1, interestFree: false, categoryId: null, note: "", currency: "COP" } as const;
    async function register(input: Partial<TransactionPlanInput>) {
      const { data, error } = await client.rpc("create_transaction_with_installments", { p_payload: buildTransactionPlan({ ...purchase, date: "2026-11-01", amount: "1", merchant: "", ...input } as TransactionPlanInput, card).payload });
      expect(error).toBeNull();
      return String(data);
    }
    const count = () => sql(`select count(*) from public.transactions where user_id = '${userId}' and source <> 'system';`).trim();
    const run = (file: MonthlyFile, decisions: unknown, dryRun: boolean) => runMonthlyImport(client as never, userId, JSON.stringify(file), decisions, dryRun);
    let created = false;
    try {
      sql(`insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,advance_rate_ea,advance_fee,handling_fee,interest_mode)
        values ('${cardId}','${userId}','Visa sintética','Bancolombia','Visa','7777',10000000,15,2,0.283288,0.283288,6840,25000,'on_balance');
        insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date)
        values ('${randomUUID()}','${userId}','${cardId}','Netflix',44900,'COP','monthly',6,'2026-10-06'), ('${randomUUID()}','${userId}','${cardId}','DirecTV',83350,'COP','monthly',4,'2026-10-04');`);
      created = true;
      await register({ date: "2026-11-03", amount: "25000", merchant: "Mercado" });
      const tienda = await register({ date: "2026-11-04", amount: "30000", merchant: "Tienda A" });
      const netflix = await register({ date: "2026-11-06", amount: "44900", merchant: "Netflix" });
      const directv = await register({ date: "2026-11-04", amount: "83350", merchant: "DirecTV" });
      await register({ type: "interest", date: "2026-11-15", amount: "12000", merchant: "Intereses" });
      // Charges created by the daily job carry their subscription.
      sql(`update public.transactions t set subscription_id = s.id, source = 'subscription' from public.subscriptions s where t.id in ('${netflix}', '${directv}') and s.user_id = '${userId}' and s.name = t.merchant;`);
      const before = count();

      const preview = await run(november, undefined, true);
      if (!preview.ok) throw new Error(preview.error);
      expect(Object.fromEntries(preview.review.rows.map((row) => [row.key, [row.status, row.reason ?? null]]))).toEqual({
        "t-mercado": ["registered", null], "t-tienda": ["conflict", "same_day_amount"], "t-netflix": ["registered", null], "t-directv": ["conflict", "subscription_amount"],
        "t-manejo": ["registered", null], "t-interes": ["registered", null], "t-nevera": ["new", null], "t-nueva": ["new", null], "p-nov": ["payment_missing", null],
      });
      expect(count()).toBe(before);
      expect(sql(`select count(*) from public.statement_balances where user_id = '${userId}';`).trim()).toBe("0");

      const decisions = { "t-tienda": "link", "t-directv": "skip" };
      const checked = await run(november, decisions, true);
      const saved = await run(november, decisions, false);
      if (!checked.ok || !saved.ok) throw new Error("La importación falló.");
      expect([saved.created, saved.linked]).toEqual([2, 1]);
      expect(saved.verification).toEqual(checked.verification);
      expect(saved.verification[0]).toMatchObject({ currency: "COP", realMinimum: "400000.00", realTotal: "900000.00" });
      expect(count()).toBe(String(Number(before) + 2));
      expect(sql(`select import_key, amount, merchant from public.transactions where id = '${tienda}';`).trim()).toBe("t-tienda|30000.00|Tienda A");
      expect(sql(`select prior_installments, installments_count, source from public.transactions where import_key = 't-nevera';`).trim()).toBe("3|6|import");
      expect(sql(`select count(*) from public.transactions where user_id = '${userId}' and type = 'payment';`).trim()).toBe("0");

      const again = await run(november, decisions, false);
      if (!again.ok) throw new Error(again.error);
      expect([again.created, again.linked]).toEqual([0, 0]);
      expect(again.review.rows.filter((row) => row.status === "new")).toEqual([]);
      expect(count()).toBe(String(Number(before) + 2));

      // Next month the bank lists the same purchases with their keys: no conflict left.
      const december = monthlyFile([
        { ...base, key: "t-tienda", type: "purchase", date: "2026-11-04", merchant: "Tienda B", amount: "30000" },
        { ...november.transactions[6]!, current_installment: 5, statement_cutoff: "2026-12-15" },
      ]);
      december.statements = [{ card: "visa", cutoff_date: "2026-12-15", due_date: "2027-01-02", balances: [] }];
      const next = await run(december, undefined, true);
      if (!next.ok) throw new Error(next.error);
      expect(next.review.rows.map((row) => row.status)).toEqual(["registered", "registered"]);

      const unknown = { ...november, cards: [{ ...november.cards[0]!, last4: "0000" }] };
      expect(await run(unknown, undefined, false)).toEqual({ ok: false, error: "No tienes una tarjeta activa terminada en 0000. Regístrala antes de importar." });
      expect((await runMonthlyImport(client as never, userId, "{", undefined, false)).ok).toBe(false);
      expect((await run(november, { "t-tienda": "borrar" }, false)).ok).toBe(false);
      expect(count()).toBe(String(Number(before) + 2));
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}';`);
    }
  }, 30000);
});
