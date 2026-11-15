import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadMonthOverview } from "../months";
import { createSupabaseMonthSource } from "../supabase-months";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("month reads against local Supabase", () => {
  it("reads synthetic charges, installments and archived balances through authenticated RLS", async () => {
    const userId = randomUUID();
    const cardId = randomUUID();
    const archivedId = randomUUID();
    const statementId = randomUUID();
    const purchaseId = randomUUID();
    const categoryId = randomUUID();
    const subscriptionId = randomUUID();
    const sql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q"], { input, stdio: ["pipe", "pipe", "pipe"] });
    const envText = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" });
    const env = Object.fromEntries(envText.split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    const anonKey = env.ANON_KEY;
    const secret = env.JWT_SECRET;
    if (!anonKey || !secret) throw new Error("Falta configuración local de Supabase.");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const signature = createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const client = createClient("http://127.0.0.1:54321", anonKey, {
      auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${header}.${payload}.${signature}` } },
    });
    let created = false;
    try {
      sql(`
        begin;
        insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,handling_fee,archived_at)
        values ('${cardId}','${userId}','Visa sintética','Banco','Visa','1234',1000000,25,28,0,null),
               ('${archivedId}','${userId}','Archivada sintética','Banco','Visa','5678',1000000,25,28,0,now());
        insert into public.categories (id,user_id,name,icon) values ('${categoryId}','${userId}','Categoría sintética','tags');
        insert into public.statements (id,user_id,card_id,period_start,cutoff_date,due_date)
        values ('${statementId}','${userId}','${cardId}','2026-10-26','2026-11-25','2026-11-28');
        insert into public.transactions (id,user_id,card_id,statement_id,category_id,type,date,amount,amount_cop,installments_count)
        values ('${purchaseId}','${userId}','${cardId}','${statementId}','${categoryId}','purchase','2026-11-10',200000,200000,2);
        insert into public.installments (user_id,transaction_id,statement_id,number,principal,interest,total,balance_after,principal_cop,interest_cop,total_cop)
        values ('${userId}','${purchaseId}','${statementId}',1,100000,5000,105000,100000,100000,5000,105000);
        insert into public.subscriptions (id,user_id,card_id,category_id,name,amount,currency,frequency,billing_day,start_date,status)
        values ('${subscriptionId}','${userId}','${cardId}','${categoryId}','Servicio sintético',20000,'COP','monthly',20,'2026-01-01','active');
        commit;
      `);
      created = true;
      const source = createSupabaseMonthSource(client as never, userId);
      const [overview, cards] = await Promise.all([loadMonthOverview(source, "2026-11-14"), source.loadCardDetails()]);
      expect(cards).toHaveLength(2);
      expect(cards.find((card) => card.id === archivedId)?.archived).toBe(true);
      expect(overview.current.total.toString()).toBe("125000");
      expect(overview.current.pendingConfirmation.toString()).toBe("105000");
      expect(overview.current.projected.toString()).toBe("20000");
      expect(overview.current.statements[0]?.charges?.find((charge) => charge.concept === "installments")?.categoryId).toBe(categoryId);
      expect(overview.subscriptionNames[subscriptionId]).toBe("Servicio sintético");
      const { error } = await client.from("statements").update({ paid_at: "2026-11-14T12:00:00Z" }).eq("id", statementId);
      expect(error).toBeNull();
      const refreshedSource = createSupabaseMonthSource(client as never, userId);
      const [paid, paidCards] = await Promise.all([loadMonthOverview(refreshedSource, "2026-11-14"), refreshedSource.loadCardDetails()]);
      expect(paid.current.pendingConfirmation.isZero()).toBe(true);
      expect(paid.current.total.eq(overview.current.total)).toBe(true);
      expect(paid.current.statements[0]?.paidAt).toBeTruthy();
      expect(paidCards.find((card) => card.id === cardId)?.used.eq(cards.find((card) => card.id === cardId)!.used)).toBe(true);
      expect(paidCards.find((card) => card.id === cardId)?.available.eq(cards.find((card) => card.id === cardId)!.available)).toBe(true);
      const installments = Array.from({ length: 6 }, (_, index) => ({
        number: index + 1, cutoff_date: `2027-${String(index + 1).padStart(2, "0")}-25`,
        principal: "100000", interest: "0", total: "100000", balance_after: String((5 - index) * 100000),
        principal_cop: "100000", interest_cop: "0", total_cop: "100000",
      }));
      const purchase = await client.rpc("create_transaction_with_installments", { p_payload: {
        card_id: cardId, type: "purchase", date: "2027-01-10", amount: "600000", currency: "COP",
        fx_rate: null, amount_cop: "600000", installments_count: 6, interest_free: true,
        rate_ea_applied: "0", category_id: categoryId, merchant: "Compra sintética", note: "", installments,
      } });
      expect(purchase.error).toBeNull();
      const withPurchase = await loadMonthOverview(createSupabaseMonthSource(client as never, userId), "2026-11-14");
      const affected = withPurchase.future.filter((month) => month.month >= "2027-01" && month.month <= "2027-06");
      expect(affected.map((month) => month.month)).toEqual(["2027-01", "2027-02", "2027-03", "2027-04", "2027-05", "2027-06"]);
      expect(affected.every((month) => month.total.eq(120000))).toBe(true);
    } finally {
      if (created) sql(`delete from auth.users where id = '${userId}';`);
    }
  }, 15000);
});
