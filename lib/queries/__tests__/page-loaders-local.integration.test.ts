import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadCardDetail } from "../card-detail";
import { loadCardList } from "../card-list";
import { loadCardOverview } from "../card-overview";
import { loadDraftInbox } from "../draft-inbox";
import { loadHistory } from "../history";
import { loadHome } from "../home";
import { loadMonthList } from "../month-list";
import { loadMonthPage } from "../month-page";
import { loadSettings } from "../settings";
import { loadStatementDetail } from "../statement-detail";
import { loadSubscriptionList } from "../subscription-list";
import { loadTransactionDetail } from "../transaction-detail";
import { loadNewTransactionForm, loadTransactionEditForm } from "../transaction-form";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";
const today = "2026-11-27";

describe.skipIf(!enabled)("page loaders against local Supabase", () => {
  it("read every screen through authenticated RLS with synthetic data", async () => {
    const id = () => randomUUID();
    const [userId, visa, master, archived, v1, v2, v3, m2, nevera, curso, mercado, subscription, draft] = [id(), id(), id(), id(), id(), id(), id(), id(), id(), id(), id(), id(), id()];
    const sql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q"], { input, stdio: ["pipe", "pipe", "pipe"] });
    const envText = execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" });
    const env = Object.fromEntries(envText.split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    if (!env.ANON_KEY || !env.JWT_SECRET) throw new Error("Falta configuración local de Supabase.");
    const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated", exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url");
    const signature = createHmac("sha256", env.JWT_SECRET).update(`${header}.${payload}`).digest("base64url");
    const client = createClient("http://127.0.0.1:54321", env.ANON_KEY, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${header}.${payload}.${signature}` } } }) as never;
    let created = false;
    try {
      sql(`
        begin;
        insert into auth.users (id,email) values ('${userId}', '${userId}@example.test');
        insert into public.cards (id,user_id,name,bank,network,last4,credit_limit,cutoff_day,payment_day,purchase_rate_ea,handling_fee,interest_mode,color,archived_at) values
          ('${visa}','${userId}','Visa sintética','Banco','Visa','1234',1000000,15,2,0.285,0,'on_balance','card-1',null),
          ('${master}','${userId}','Master sintética','Banco','Mastercard','5678',2000000,25,10,0.285,0,'per_installment','card-3',null),
          ('${archived}','${userId}','Archivada sintética','Banco','Visa','9012',500000,5,20,0.26,0,'per_installment','card-6',now());
        insert into public.statements (id,user_id,card_id,period_start,cutoff_date,due_date) values
          ('${v1}','${userId}','${visa}','2026-09-16','2026-10-15','2026-11-02'),
          ('${v2}','${userId}','${visa}','2026-10-16','2026-11-15','2026-12-02'),
          ('${v3}','${userId}','${visa}','2026-11-16','2026-12-15','2027-01-02'),
          ('${m2}','${userId}','${master}','2026-10-26','2026-11-25','2026-12-10');
        insert into public.subscriptions (id,user_id,card_id,name,amount,currency,frequency,billing_day,start_date,status) values
          ('${subscription}','${userId}','${visa}','Servicio sintético',20000,'COP','monthly',5,'2026-01-05','active');
        insert into public.transactions (id,user_id,card_id,statement_id,type,date,merchant,amount,currency,fx_rate,amount_cop,installments_count,rate_ea_applied,subscription_id,source,is_international) values
          ('${mercado}','${userId}','${visa}','${v1}','purchase','2026-10-02','Mercado sintético',150000,'COP',null,150000,1,0.285,null,'manual',false),
          ('${nevera}','${userId}','${visa}','${v2}','purchase','2026-10-20','Nevera sintética',300000,'COP',null,300000,3,0.285,null,'manual',false),
          ('${id()}','${userId}','${visa}','${v2}','purchase','2026-11-05','Servicio sintético',20000,'COP',null,20000,1,0.285,'${subscription}','subscription',false),
          ('${id()}','${userId}','${visa}','${v3}','purchase','2026-11-20','Farmacia sintética',62000,'COP',null,62000,1,0.285,null,'manual',false),
          ('${curso}','${userId}','${master}','${m2}','purchase','2026-11-03','Curso sintético',30,'USD',4000,120000,2,0.285,null,'manual',true);
        insert into public.installments (user_id,transaction_id,statement_id,number,principal,interest,total,balance_after,principal_cop,interest_cop,total_cop) values
          ('${userId}','${nevera}','${v2}',1,100000,0,100000,200000,100000,0,100000),
          ('${userId}','${nevera}','${v3}',2,100000,0,100000,100000,100000,0,100000),
          ('${userId}','${curso}','${m2}',1,15,0.63,15.63,15,60000,2520,62520);
        insert into public.statement_balances (user_id,statement_id,currency,paid_at) values ('${userId}','${v1}','COP','2026-11-01 10:00-05');
        insert into public.transaction_drafts (id,user_id,external_id,phrase,card_id,last4,type,amount,currency,merchant_raw,occurred_on,status) values
          ('${draft}','${userId}','synthetic-${draft}','Frase sintética','${visa}','1234','purchase',35000,'COP','TIENDA SINTETICA','2026-11-26','pending');
        commit;
      `);
      created = true;

      const statement = (await loadStatementDetail(client, userId, visa, "2026-11-15", today))!;
      expect(statement.statement?.id).toBe(v2);
      expect(statement.neighbors).toEqual({ previous: "2026-10-15", next: "2026-12-15" });
      expect(statement.breakdowns[0]!.concepts.find((item) => item.key === "installments")!.entries).toMatchObject([{ transactionId: nevera, number: 1, installmentsCount: 3, date: "2026-10-20" }]);
      expect(statement.closeContexts.length).toBeGreaterThan(0);
      expect(await loadStatementDetail(client, userId, visa, "2026-11-16", today)).toBeNull();

      const card = (await loadCardDetail(client, userId, visa, today))!;
      expect(card.openCutoff).toBe("2026-12-15");
      expect(card.activePurchases).toMatchObject([{ purchase: { id: nevera }, progress: { current: 2, count: 2 }, lastCutoffDate: "2026-12-15" }]);
      expect(await loadCardDetail(client, userId, randomUUID(), today)).toBeNull();

      const transaction = (await loadTransactionDetail(client, userId, nevera, today))!;
      expect(transaction.items.map((item) => item.cutoffDate)).toEqual(["2026-11-15", "2026-12-15"]);
      expect(transaction.editable).toBe(true);
      const edit = (await loadTransactionEditForm(client, userId, nevera, today))!;
      expect(edit.mode).toBe("full");
      const form = (await loadNewTransactionForm(client, userId, today))!;
      expect(form.cards.map((item) => item.id).sort()).toEqual([visa, master].sort());
      expect((await loadNewTransactionForm(client, userId, today, draft))!.captured).toMatchObject({ id: draft, values: { cardId: visa, currency: "COP" } });
      expect(await loadNewTransactionForm(client, userId, today, randomUUID())).toBeNull();

      const history = await loadHistory(client, userId, { mes: "2026-11", tarjeta: undefined, categoria: undefined, tipo: undefined, q: undefined, pagina: 1 });
      expect(history.filtered).toHaveLength(3);
      const subscriptions = await loadSubscriptionList(client, userId, today);
      expect(subscriptions.charges.map((item) => item.subscription_id)).toEqual([subscription]);
      const settings = await loadSettings(client, userId);
      expect(settings.cards.find((item) => item.id === visa)?.hasInstallmentPurchases).toBe(true);
      expect(settings.cards.find((item) => item.id === archived)?.hasInstallmentPurchases).toBe(false);
      expect((await loadDraftInbox(client, userId)).drafts.map((item) => item.id)).toEqual([draft]);

      const months = await loadMonthList(client, userId, today, 12);
      expect(months.draftCount).toBe(1);
      expect((await loadMonthPage(client, userId, today, "2026-12"))!.month.cards.map((group) => group.cardId).sort()).toEqual([visa, master].sort());

      const home = await loadHome(client, userId, today);
      expect(home.nextPayment).toMatchObject({ month: "2026-12", dueDate: "2026-12-02" });
      expect(home.nextPayment!.usd.toString()).toBe("15.63");
      expect(home.creditUsed.usd.toString()).toBe("30.63");
      expect(home.attention.map((item) => item.kind)).toEqual(["due_soon", "drafts", "reconcile", "reconcile"]);
      const list = await loadCardList(client, userId, today);
      expect(list.active.map((entry) => entry.card.id)).toEqual([master, visa]);
      expect(list.archived.map((entry) => entry.card.id)).toEqual([archived]);
      expect(list.active[1]).toMatchObject({ subscriptions: 1, installmentsInProgress: [{ purchase: { id: nevera } }], open: { cutoffDate: "2026-12-15" } });
      const overview = (await loadCardOverview(client, userId, visa, today))!;
      expect(overview.openStatement.groups[0]!.newPurchases.map((item) => item.merchant)).toEqual(["Farmacia sintética"]);
      expect(overview.openStatement.groups[0]!.installments.map((item) => item.transactionId)).toEqual([nevera]);
      expect(overview.openStatement.groups[0]!.subscriptions.projected).toMatchObject([{ subscriptionId: subscription, date: "2026-12-05" }]);
      expect(overview.subscriptions).toMatchObject([{ nextCharge: "2026-12-05" }]);
      expect(overview.statementColumns.map((column) => column.state)).toContain("open");
    } finally {
      if (created) sql(`
        begin;
        delete from public.transaction_drafts where user_id = '${userId}';
        delete from public.installments where user_id = '${userId}';
        delete from public.transactions where user_id = '${userId}';
        delete from public.statement_balances where user_id = '${userId}';
        delete from public.statements where user_id = '${userId}';
        delete from public.subscriptions where user_id = '${userId}';
        delete from public.cards where user_id = '${userId}';
        delete from auth.users where id = '${userId}';
        commit;
      `);
    }
  }, 60_000);
});
