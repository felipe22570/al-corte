import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { describe, expect, it } from "vitest";

import { ALERTS } from "@/lib/ingest/__tests__/fixtures";
import { verifyAlertSignature } from "@/lib/ingest/signature";

const SECRET = "test-secret-with-at-least-32-characters-0000";
const URL_PROPERTY = "https://al-corte.example/api/ingest/alerts";
const AUTH = "mx.google.com; dkim=pass header.i=@notificacionesbancolombia.com header.s=sel1; dmarc=pass header.from=notificacionesbancolombia.com";
const FROM = "Alertas Bancolombia <alertasynotificaciones@notificacionesbancolombia.com>";

type Fetch = (url: string, options: { payload: number[]; headers: Record<string, string>; followRedirects: boolean; muteHttpExceptions: boolean }) => { status: number; body: string };
type GmailMessage = { id: string; payload: unknown };

const signed = (buffer: Buffer) => Array.from(buffer).map((byte) => (byte > 127 ? byte - 256 : byte));
const unsigned = (bytes: number[]) => Buffer.from(bytes.map((byte) => byte & 0xff));

/** Minimal stand-ins for the Apps Script services `main.js` uses. */
function appsScript(messages: GmailMessage[], fetch: Fetch, initialProperties: Record<string, string> = {}) {
  const properties: Record<string, string> = { INGEST_URL: URL_PROPERTY, INGEST_SIGNING_SECRET: SECRET, ...initialProperties };
  const logs: string[] = [];
  const triggers: Array<{ handler: string; hours: number }> = [];
  const requests: Array<{ url: string; body: string; headers: Record<string, string>; followRedirects: boolean }> = [];
  const blob = (bytes: Buffer) => ({
    getDataAsString: (charset: string) => bytes.toString(/iso-8859-1/i.test(charset) ? "latin1" : "utf8"),
    setDataFromString: (text: string) => blob(Buffer.from(text, "utf8")),
    getBytes: () => signed(bytes),
  });
  const globals = {
    console: { log: (text: string) => logs.push(text) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key: string) => properties[key] ?? null, setProperty: (key: string, value: string) => { properties[key] = value; } }) },
    Utilities: {
      Charset: { UTF_8: "UTF-8" },
      computeHmacSha256Signature: (text: string, key: string) => signed(createHmac("sha256", key).update(text, "utf8").digest()),
      base64DecodeWebSafe: (text: string) => signed(Buffer.from(text, "base64url")),
      newBlob: (bytes: number[] | string) => blob(typeof bytes === "string" ? Buffer.from(bytes, "utf8") : unsigned(bytes)),
    },
    Gmail: {
      Users: {
        Messages: {
          list: (_user: string, options: { q: string }) => ({ messages: options.q.includes("notificacionesbancolombia.com") ? messages.map(({ id }) => ({ id })).reverse() : [] }),
          get: (_user: string, id: string) => messages.find((item) => item.id === id),
        },
      },
    },
    UrlFetchApp: {
      fetch: (url: string, options: Parameters<Fetch>[1]) => {
        const body = unsigned(options.payload).toString("utf8");
        requests.push({ url, body, headers: options.headers, followRedirects: options.followRedirects });
        const answer = fetch(url, options);
        return { getResponseCode: () => answer.status, getContentText: () => answer.body };
      },
    },
    ScriptApp: {
      AuthMode: { FULL: "FULL" },
      requireScopes: () => undefined,
      getProjectTriggers: () => triggers.map((trigger) => ({ getHandlerFunction: () => trigger.handler, trigger })),
      deleteTrigger: (wrapper: { trigger: { handler: string } }) => triggers.splice(triggers.indexOf(wrapper.trigger as never), 1),
      newTrigger: (handler: string) => ({ timeBased: () => ({ everyHours: (hours: number) => ({ create: () => triggers.push({ handler, hours }) }) }) }),
    },
  };
  const context = createContext(globals);
  for (const file of ["core.js", "main.js"]) runInContext(readFileSync(new URL(`../src/${file}`, import.meta.url), "utf8"), context, { filename: file });
  const call = (name: string) => (context as unknown as Record<string, () => void>)[name]!();
  return { call, properties, logs, triggers, requests };
}

const alertEmail = (id: string, phrase: string, charset = "UTF-8"): GmailMessage => {
  const encoding = charset === "UTF-8" ? "utf8" : "latin1";
  const text = `Hola, cliente\n${phrase}\nSi tienes dudas, comunícate con nosotros.`;
  return {
    id,
    payload: {
      mimeType: "multipart/alternative",
      headers: [{ name: "Authentication-Results", value: AUTH }, { name: "From", value: FROM }],
      parts: [
        { mimeType: "text/plain", filename: "", headers: [{ name: "Content-Type", value: `text/plain; charset=${charset}` }], body: { data: signed(Buffer.from(text, encoding)) } },
        { mimeType: "text/html", filename: "", headers: [], body: { data: Buffer.from(`<p>${text}</p>`, "utf8").toString("base64url") } },
      ],
    },
  };
};

const created = () => ({ status: 200, body: JSON.stringify({ ok: true, result: "created" }) });

describe("Apps Script adapter (step 44)", () => {
  it("sends the signed phrase of each credit card alert and saves the state", () => {
    const accented = ALERTS.directv.replace("esta asociada", "está asociada");
    const script = appsScript([alertEmail("m1", accented, "ISO-8859-1"), alertEmail("m2", ALERTS.savings)], created);
    script.call("capturePurchaseAlerts");

    expect(script.requests).toHaveLength(1);
    const [request] = script.requests;
    expect(request!.url).toBe(URL_PROPERTY);
    expect(request!.followRedirects).toBe(false);
    expect(JSON.parse(request!.body)).toEqual({ message_id: "m1", phrase: accented });
    const timestamp = request!.headers["X-Al-Corte-Timestamp"]!;
    expect(verifyAlertSignature(SECRET, timestamp, request!.headers["X-Al-Corte-Signature"]!, request!.body, new Date(Number(timestamp) * 1000))).toBe(true);

    const state = JSON.parse(script.properties.AL_CORTE_CAPTURE_STATE!);
    expect(Object.keys(state).sort()).toEqual(["m1", "m2"]);
    expect(state.m1.s).toBe("processed");
    expect(state.m2.s).toBe("discarded");
    expect(script.logs.join("\n")).not.toContain("DIRECTV");
    expect(script.logs.at(-1)).toContain("enviados=1");
  });

  it("without a connection keeps the message for the next run", () => {
    let online = false;
    const script = appsScript([alertEmail("m1", ALERTS.chatgpt)], () => {
      if (!online) throw new Error("Address unavailable");
      return created();
    });
    script.call("capturePurchaseAlerts");
    expect(JSON.parse(script.properties.AL_CORTE_CAPTURE_STATE!)).toEqual({});

    online = true;
    script.call("capturePurchaseAlerts");
    expect(script.requests).toHaveLength(2);
    expect(JSON.parse(script.properties.AL_CORTE_CAPTURE_STATE!).m1.s).toBe("processed");
  });

  it("refuses to run without an https URL or the secret", () => {
    expect(() => appsScript([], created, { INGEST_URL: "http://al-corte.example/api/ingest/alerts" }).call("capturePurchaseAlerts")).toThrow(/INGEST_URL/);
    expect(() => appsScript([], created, { INGEST_SIGNING_SECRET: "" }).call("capturePurchaseAlerts")).toThrow(/INGEST_SIGNING_SECRET/);
  });

  it("installs a single hourly trigger and removes it", () => {
    const script = appsScript([], created);
    script.call("installTrigger");
    script.call("installTrigger");
    expect(script.triggers).toEqual([{ handler: "capturePurchaseAlerts", hours: 1 }]);
    script.call("removeTrigger");
    expect(script.triggers).toEqual([]);
  });
});
