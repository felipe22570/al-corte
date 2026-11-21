import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildImportSql } from "../statement-import";
import { trmByDate } from "../trm";
import { syntheticImport, syntheticTrm } from "./fixture";

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";

describe.skipIf(!enabled)("statement import script against local Supabase", () => {
  it("imports the synthetic file through the app's RPCs, twice without duplicates (D36)", () => {
    const userId = randomUUID();
    const email = `${userId}@example.test`;
    const psql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A"], { input, encoding: "utf8" });
    const { sql } = buildImportSql(syntheticImport(), { trm: trmByDate(syntheticTrm), advanceFees: { visa: "6840" }, trmSource: "TRM de prueba", generatedOn: "2026-11-21" });
    const script = sql.replace("'__PENDIENTE__', true);", `'${email}', true);`);
    const snapshot = () => psql(`
      select count(*) from public.transactions where user_id = '${userId}';
      select count(*) from public.subscriptions where user_id = '${userId}';
      select string_agg(import_key || ':' || statement_override::text || ':' || source::text, ',' order by import_key) from public.transactions where user_id = '${userId}';
      select string_agg(currency::text || ':' || coalesce(real_minimum::text, '-') || ':' || (paid_at is not null)::text, ',' order by currency, real_minimum) from public.statement_balances where user_id = '${userId}';
      select count(*) from public.transactions where user_id = '${userId}' and subscription_id is not null;
      select installments_count || '/' || original_installments_count from public.transactions where user_id = '${userId}' and import_key = 't-usd';`).trim();
    let created = false;
    try {
      psql(`insert into auth.users (id, email) values ('${userId}', '${email}');`);
      created = true;
      expect(() => psql(sql)).toThrow("Completa el correo");
      psql(script);
      const first = snapshot();
      psql(script);
      expect(snapshot()).toBe(first);
      const [transactions, subscriptions, keys, balances, linked, plan] = first.split("\n");
      expect(transactions).toBe("7");
      expect(subscriptions).toBe("2");
      expect(keys).toBe("t-avance:false:import,t-borde:true:import,t-comision:false:import,t-curso:false:import,t-interes:false:import,t-mensual:false:subscription,t-usd:false:subscription");
      expect(balances).toBe("COP:150000.00:false,COP:-:true,USD:1.00:false");
      expect(linked).toBe("2");
      expect(plan).toBe("35/36");
    } finally {
      if (created) psql(`delete from auth.users where id = '${userId}';`);
    }
  }, 30000);
});
