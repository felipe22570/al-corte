import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { signAlert } from "../signature";
import { ALERTS } from "./fixtures";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const enabled = process.env.AL_CORTE_LOCAL_DB_TEST === "1";
const secret = "local-ingest-secret-".padEnd(48, "x");

describe.skipIf(!enabled)("alert ingest route against local Supabase", () => {
  const owner = randomUUID();
  const other = randomUUID();
  const sql = (input: string) => execFileSync("docker", ["exec", "-i", "supabase_db_al-corte", "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A"], { input, encoding: "utf8" }).trim();
  let POST: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    const env = Object.fromEntries(execFileSync("pnpm", ["exec", "supabase", "status", "-o", "env"], { encoding: "utf8" }).split("\n").flatMap((line) => {
      const match = /^([A-Z_]+)="(.*)"$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_SECRET_KEY", env.SECRET_KEY ?? "");
    vi.stubEnv("INGEST_SIGNING_SECRET", secret);
    vi.stubEnv("INGEST_USER_ID", owner);
    sql(`insert into auth.users (id, email) values ('${owner}', 'ingest-${owner}@example.com'), ('${other}', 'ingest-${other}@example.com');
      insert into public.cards (id, user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day) values
        ('${owner.slice(0, 24)}000000000001', '${owner}', 'Visa', 'Banco', 'Visa', '1999', 1000000, 15, 2),
        ('${other.slice(0, 24)}000000000001', '${other}', 'Otra', 'Banco', 'Visa', '1999', 1000000, 15, 2);`);
    ({ POST } = await import("@/app/api/ingest/alerts/route"));
  });
  afterAll(() => {
    sql(`delete from auth.users where id in ('${owner}', '${other}');`);
    vi.unstubAllEnvs();
  });

  function request(payload: unknown) {
    const body = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    return new Request("http://localhost/api/ingest/alerts", {
      method: "POST", body, headers: { "content-type": "application/json", "x-al-corte-timestamp": timestamp, "x-al-corte-signature": signAlert(secret, timestamp, body) },
    });
  }
  const drafts = () => sql(`select external_id || '|' || status || '|' || coalesce(card_id::text, '-') || '|' || coalesce(amount::text, '-') from public.transaction_drafts where user_id in ('${owner}', '${other}') order by external_id;`);

  it("rejects while capture is off, then creates drafts only for the configured owner", async () => {
    const off = await POST(request({ message_id: "m1", phrase: ALERTS.directv }));
    expect([off.status, await off.json()]).toEqual([403, { ok: false }]);
    expect(drafts()).toBe("");

    sql(`insert into public.capture_settings (user_id, enabled) values ('${owner}', true);`);
    const created = await POST(request({ message_id: "m1", phrase: ALERTS.directv }));
    expect([created.status, await created.json()]).toEqual([200, { ok: true, result: "created" }]);
    expect(created.headers.get("cache-control")).toBe("no-store");
    // The other owner's card with the same digits is never used (RLS does not apply to the service key).
    expect(drafts()).toBe(`m1|pending|${owner.slice(0, 24)}000000000001|140910.00`);
    expect(sql(`select count(*) from public.transaction_drafts where user_id <> '${owner}' and user_id in ('${owner}', '${other}');`)).toBe("0");

    const again = await POST(request({ message_id: "m1", phrase: ALERTS.directv }));
    expect(await again.json()).toEqual({ ok: true, result: "duplicate" });

    const ignored = await POST(request({ message_id: "m2", phrase: ALERTS.savings }));
    expect(await ignored.json()).toEqual({ ok: true, result: "ignored" });
    expect(sql(`select count(*) from public.transaction_drafts where user_id = '${owner}';`)).toBe("1");
  });

  it("uses aliases and marks shared digits as an unknown card", async () => {
    sql(`insert into public.card_aliases (user_id, card_id, last4) values ('${owner}', '${owner.slice(0, 24)}000000000001', '4321');`);
    await POST(request({ message_id: "m3", phrase: ALERTS.chatgpt.replace("*1999", "*4321") }));
    sql(`insert into public.cards (user_id, name, bank, network, last4, credit_limit, cutoff_day, payment_day) values ('${owner}', 'Visa 2', 'Banco', 'Visa', '1999', 1000000, 30, 10);`);
    await POST(request({ message_id: "m4", phrase: ALERTS.chatgpt }));
    expect(drafts().split("\n").slice(1)).toEqual([`m3|pending|${owner.slice(0, 24)}000000000001|81000.00`, "m4|unknown_card|-|81000.00"]);
  });

  it("rejects an unsigned request and stops at the per-minute limit", async () => {
    const unsigned = await POST(new Request("http://localhost/api/ingest/alerts", { method: "POST", body: JSON.stringify({ message_id: "x", phrase: ALERTS.directv }) }));
    expect([unsigned.status, await unsigned.json()]).toEqual([401, { ok: false }]);
    // The previous test used part of this minute's limit; the counter never lets more than 30 through.
    const statuses: number[] = [];
    for (let index = 0; index < 32; index += 1) statuses.push((await POST(request({ message_id: `r${index}`, phrase: ALERTS.savings }))).status);
    expect(statuses.filter((status) => status === 429).length).toBeGreaterThanOrEqual(2);
    expect(statuses.filter((status) => status === 200).length).toBeLessThanOrEqual(30);
  });
});
