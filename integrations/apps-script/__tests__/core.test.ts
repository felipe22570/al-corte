import { createHmac } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { ALERTS } from "@/lib/ingest/__tests__/fixtures";
import { signAlert, verifyAlertSignature } from "@/lib/ingest/signature";

import { type CaptureMessage, type CaptureRequest, type CaptureResponse, type CaptureState, loadCore, type MessageHeader } from "./load-core";

const core = loadCore();
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const SECRET = "test-secret-with-at-least-32-characters-0000";
const NOW = 1_795_000_000;
const FROM = "\"Alertas y Notificaciones Bancolombia\" <alertasynotificaciones@notificacionesbancolombia.com>";
const GOOGLE_PASS = [
  "mx.google.com;",
  "       dkim=pass header.i=@notificacionesbancolombia.com header.s=sel1 header.b=AbCdEf12;",
  "       spf=pass (google.com: domain of alertasynotificaciones@notificacionesbancolombia.com designates 192.0.2.10 as permitted sender) smtp.mailfrom=alertasynotificaciones@notificacionesbancolombia.com;",
  "       dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=notificacionesbancolombia.com",
].join("\r\n");
const GOOGLE_FAIL = GOOGLE_PASS.replace("dkim=pass", "dkim=fail");

const headers = (authenticationResults: string[] = [GOOGLE_PASS], from = FROM): MessageHeader[] => [
  { name: "Delivered-To", value: "owner@example.com" },
  ...authenticationResults.map((value) => ({ name: "Authentication-Results", value })),
  { name: "Received", value: "from mail.example by mx.google.com" },
  { name: "From", value: from },
  { name: "Subject", value: "Alertas y Notificaciones" },
];

const emailText = (phrase: string) => [
  "Hola, cliente",
  "",
  phrase.replace(" el ", "\nel "),
  "",
  "Si tienes dudas, comunícate con nuestra Sucursal Telefónica.",
  "Este correo es informativo. Por favor no lo respondas.",
].join("\n");

const message = (id: string, phrase: string, overrides: Partial<CaptureMessage> = {}): CaptureMessage => ({
  id, headers: headers(), plain: emailText(phrase), html: null, ...overrides,
});

const APEX = "notificacionesbancolombia.com";
const SEARCH_FROM = "from:(alertasynotificaciones@notificacionesbancolombia.com OR alertasynotificaciones@an.notificacionesbancolombia.com OR alertasynotificaciones@ayn.notificacionesbancolombia.com)";
const dkim = (list: MessageHeader[], domain = APEX) => core.isGoogleDkimPass(list, domain);

/** The two real formats of 20 and 24 Nov 2026: each subdomain signs its own alerts. */
const subdomainMessage = (id: string, phrase: string, sub: "an" | "ayn", signedBy = sub) => message(id, phrase, {
  headers: headers([GOOGLE_PASS.replace("header.i=@notificacionesbancolombia.com", `header.i=@${signedBy}.notificacionesbancolombia.com`)], `Alertas y Notificaciones <alertasynotificaciones@${sub}.notificacionesbancolombia.com>`),
});

const nodeSign = (text: string) => Array.from(createHmac("sha256", SECRET).update(text, "utf8").digest()).map((byte) => (byte > 127 ? byte - 256 : byte));

function run(messages: CaptureMessage[], respond: (request: CaptureRequest) => CaptureResponse, state: CaptureState = {}) {
  const byId = new Map(messages.map((item) => [item.id, item]));
  const load = vi.fn((id: string) => byId.get(id)!);
  const send = vi.fn(respond);
  const result = core.processMessages(messages.map((item) => item.id), state, { nowSeconds: () => NOW, load, sign: nodeSign, send });
  return { ...plain(result), load, send };
}

const ok = (result: string): CaptureResponse => ({ status: 200, body: JSON.stringify({ ok: true, result }) });

describe("phrase extraction (step 44)", () => {
  it("keeps only the phrase between 'Bancolombia:' and 'Si tienes dudas', on one line", () => {
    expect(core.extractPhrase(emailText(ALERTS.directv))).toBe(ALERTS.directv);
  });

  it("starts at the last 'Bancolombia:' before the footer, so headings never leave Google", () => {
    const text = `Bancolombia: alertas de tu cuenta\nNombre del cliente\n${emailText(ALERTS.chatgpt)}`;
    expect(core.extractPhrase(text)).toBe(ALERTS.chatgpt);
  });

  it("returns null without the start or the end marker", () => {
    expect(core.extractPhrase("Compraste COP1.000,00 en X. Si tienes dudas, llama.")).toBeNull();
    expect(core.extractPhrase(`${ALERTS.directv}\nGracias.`)).toBeNull();
    expect(core.extractPhrase("Bancolombia: Si tienes dudas")).toBeNull();
  });

  it("normalizes non-breaking spaces and line breaks", () => {
    expect(core.extractPhrase("Bancolombia: Compraste COP1.000,00\r\n en X. Si tienes dudas")).toBe("Bancolombia: Compraste COP1.000,00 en X.");
  });

  it("reads the phrase from an HTML-only alert", () => {
    const html = "<html><head><style>p { color: red; }</style></head><body><p>Hola, cliente</p>"
      + "<p>Bancolombia: Compraste COP140.910,00 en DIRECTV,&nbsp;el 17/11/2026 a las 12:27. Esta compra est&aacute; asociada a T.Cred&nbsp;*1999</p>"
      + "<p>Si tienes dudas, comun&#237;cate con nosotros.</p></body></html>";
    expect(core.extractPhrase(core.htmlToText(html))).toBe("Bancolombia: Compraste COP140.910,00 en DIRECTV, el 17/11/2026 a las 12:27. Esta compra está asociada a T.Cred *1999");
  });

  it("decodes numeric, hexadecimal and common named entities", () => {
    expect(core.htmlToText("a&amp;b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#xE9; &ntilde;<br>f")).toBe("a&b <c> \"d\" 'e' é ñ\nf");
  });
});

describe("credit card filter (D44)", () => {
  it.each([
    ["directv", true], ["chatgpt", true], ["dollars", true], ["withCard", true], ["payment", true], ["advance", true], ["savings", false], ["debit", false],
  ] as const)("%s → %s", (key, expected) => {
    expect(core.hasCreditCardMarker(ALERTS[key])).toBe(expected);
  });

  it("accepts the card written as T.Credito or T.Crédito", () => {
    expect(core.hasCreditCardMarker(ALERTS.directv.replace("T.Cred *", "T.Credito *"))).toBe(true);
    expect(core.hasCreditCardMarker(ALERTS.directv.replace("T.Cred *", "T.Crédito *"))).toBe(true);
    expect(core.hasCreditCardMarker("Bancolombia: T.Credencial *1999")).toBe(false);
  });

  it("needs exactly 4 digits after 'T.Cred *'", () => {
    expect(core.hasCreditCardMarker("Bancolombia: T.Cred *123")).toBe(false);
    expect(core.hasCreditCardMarker("Bancolombia: T.Cred *12345")).toBe(false);
    expect(core.hasCreditCardMarker("Bancolombia: T.Cred")).toBe(false);
    expect(core.hasCreditCardMarker("Bancolombia: T. Cred * 1234")).toBe(true);
  });
});

describe("DKIM in the header added by Google (R10)", () => {
  it("passes with Google's result for the bank domain", () => {
    expect(dkim(headers())).toBe(true);
    expect(dkim([{ name: "authentication-results", value: GOOGLE_PASS }])).toBe(true);
  });

  it("rejects a forged header added below Google's", () => {
    expect(dkim(headers([GOOGLE_FAIL, GOOGLE_PASS]))).toBe(false);
  });

  it("rejects when the topmost header is not from mx.google.com", () => {
    expect(dkim(headers([GOOGLE_PASS.replace("mx.google.com", "mail.attacker.example"), GOOGLE_PASS]))).toBe(false);
    expect(dkim(headers([]))).toBe(false);
  });

  it("only accepts a passing signature of the exact domain", () => {
    for (const domain of ["mail.example", "notificacionesbancolombia.com.example", "evilnotificacionesbancolombia.com"]) {
      expect(dkim(headers([GOOGLE_PASS.replace("header.i=@notificacionesbancolombia.com", `header.i=@${domain}`)]))).toBe(false);
    }
    expect(dkim(headers([GOOGLE_PASS.replace("dkim=pass", "dkim=neutral")]))).toBe(false);
    expect(dkim(headers([GOOGLE_PASS.replace("header.i=@", "header.i=alertasynotificaciones@")]))).toBe(true);
    expect(dkim(headers([GOOGLE_PASS.replace("header.i=@notificacionesbancolombia.com", "header.d=NotificacionesBancolombia.com")]))).toBe(true);
  });

  it("accepts the bank signature next to another one", () => {
    const two = "mx.google.com;\r\n dkim=fail header.i=@relay.example header.s=a;\r\n dkim=pass header.i=@notificacionesbancolombia.com header.s=b";
    expect(dkim(headers([two]))).toBe(true);
  });

  it("needs the signature of exactly the sender's domain", () => {
    const an = headers([GOOGLE_PASS.replace("header.i=@notificacionesbancolombia.com", "header.i=@an.notificacionesbancolombia.com")]);
    expect(dkim(an, "an.notificacionesbancolombia.com")).toBe(true);
    expect(dkim(an, "ayn.notificacionesbancolombia.com")).toBe(false);
    expect(dkim(an, APEX)).toBe(false);
    expect(dkim(headers(), "an.notificacionesbancolombia.com")).toBe(false);
    expect(dkim(headers(), "")).toBe(false);
  });

  it("ignores results written inside comments", () => {
    const comment = "mx.google.com; spf=pass (dkim=pass header.i=@notificacionesbancolombia.com) smtp.mailfrom=x@example.com; dkim=fail header.i=@notificacionesbancolombia.com";
    expect(dkim(headers([comment]))).toBe(false);
  });
});

describe("message evaluation", () => {
  it("sends credit card alerts and discards savings and debit ones", () => {
    expect(plain(core.evaluateMessage(message("a", ALERTS.directv)))).toEqual({ action: "send", phrase: ALERTS.directv });
    expect(plain(core.evaluateMessage(message("b", ALERTS.savings)))).toEqual({ action: "discard", reason: "no_credit_card" });
    expect(plain(core.evaluateMessage(message("c", ALERTS.debit)))).toEqual({ action: "discard", reason: "no_credit_card" });
  });

  it("accepts the real alerts from the an. and ayn. subdomains, each with its own signature", () => {
    expect(plain(core.evaluateMessage(subdomainMessage("a", ALERTS.directv, "an")))).toEqual({ action: "send", phrase: ALERTS.directv });
    expect(plain(core.evaluateMessage(subdomainMessage("b", ALERTS.chatgpt, "ayn")))).toEqual({ action: "send", phrase: ALERTS.chatgpt });
    expect(plain(core.evaluateMessage(subdomainMessage("c", ALERTS.directv, "an", "ayn")))).toEqual({ action: "reject", reason: "dkim" });
    expect(plain(core.evaluateMessage(message("d", ALERTS.directv, { headers: headers(undefined, "alertasynotificaciones@xan.notificacionesbancolombia.com") })))).toEqual({ action: "reject", reason: "sender" });
    expect(plain(core.evaluateMessage(message("e", ALERTS.directv, { headers: headers(undefined, "otro@an.notificacionesbancolombia.com") })))).toEqual({ action: "reject", reason: "sender" });
  });

  it("rejects another sender and a failed DKIM before reading the body", () => {
    expect(plain(core.evaluateMessage(message("a", ALERTS.directv, { headers: headers(undefined, "Alertas <alertas@otro.example>") })))).toEqual({ action: "reject", reason: "sender" });
    expect(plain(core.evaluateMessage(message("b", ALERTS.directv, { headers: headers([GOOGLE_FAIL, GOOGLE_PASS]) })))).toEqual({ action: "reject", reason: "dkim" });
  });

  it("discards a message without the phrase markers", () => {
    expect(plain(core.evaluateMessage(message("a", ALERTS.directv, { plain: "Tu clave fue cambiada.", html: null })))).toEqual({ action: "discard", reason: "no_phrase" });
    expect(plain(core.evaluateMessage(message("b", ALERTS.directv, { plain: null, html: null })))).toEqual({ action: "discard", reason: "no_phrase" });
  });

  it("uses the HTML part when there is no plain text", () => {
    expect(plain(core.evaluateMessage(message("a", ALERTS.directv, { plain: null, html: `<p>${ALERTS.directv}</p><p>Si tienes dudas</p>` })))).toEqual({ action: "send", phrase: ALERTS.directv });
  });

  it("rejects phrases longer than the app accepts", () => {
    const long = `Bancolombia: ${"x".repeat(core.MAX_PHRASE_CHARS)} T.Cred *1999`;
    expect(plain(core.evaluateMessage(message("a", long)))).toEqual({ action: "reject", reason: "too_large" });
  });
});

describe("request contract with the app (step 42)", () => {
  it("signs exactly like the server, including accents", () => {
    const body = core.buildBody("18c2f0a1b2c3d4e5", "Bancolombia: Esta compra está asociada a T.Cred *1999");
    const timestamp = String(NOW);
    expect(`v1=${core.bytesToHex(nodeSign(`${timestamp}.${body}`))}`).toBe(signAlert(SECRET, timestamp, body));
  });

  it("sends a verifiable request with only the message id and the phrase", () => {
    const { send } = run([message("18c2f0a1b2c3d4e5", ALERTS.chatgpt)], () => ok("created"));
    const request = send.mock.calls[0]![0];
    expect(JSON.parse(request.body)).toEqual({ message_id: "18c2f0a1b2c3d4e5", phrase: ALERTS.chatgpt });
    expect(request.timestamp).toBe(String(NOW));
    expect(verifyAlertSignature(SECRET, request.timestamp, request.signature, request.body, new Date(NOW * 1000))).toBe(true);
  });

  it("counts UTF-8 bytes like the server", () => {
    for (const text of ["abc", "está", "ñandú €", "😀 a", "\u0000"]) expect(core.utf8Length(text)).toBe(Buffer.byteLength(text, "utf8"));
    expect(core.MAX_BODY_BYTES).toBe(4096);
  });

  it.each([
    [200, JSON.stringify({ ok: true, result: "created" }), { outcome: "processed", result: "created" }],
    [200, JSON.stringify({ ok: true, result: "duplicate" }), { outcome: "processed", result: "duplicate" }],
    [200, JSON.stringify({ ok: true, result: "ignored" }), { outcome: "processed", result: "ignored" }],
    [200, "<html>", { outcome: "retry", blocking: false }],
    [200, JSON.stringify({ ok: true, result: "other" }), { outcome: "retry", blocking: false }],
    [400, "{}", { outcome: "rejected" }],
    [413, "{}", { outcome: "rejected" }],
    [401, "{}", { outcome: "retry", blocking: true }],
    [403, "{}", { outcome: "retry", blocking: true }],
    [429, "{}", { outcome: "retry", blocking: true }],
    [503, "{}", { outcome: "retry", blocking: true }],
    [308, "", { outcome: "retry", blocking: true }],
    [500, "{}", { outcome: "retry", blocking: false }],
  ] as const)("HTTP %i %s", (status, body, expected) => {
    expect(plain(core.classifyResponse(status, body))).toEqual(expected);
  });
});

describe("processing and retries", () => {
  it("marks processed messages and skips them in the next run", () => {
    const first = run([message("m1", ALERTS.directv)], () => ok("created"));
    expect(first.state).toEqual({ m1: { s: "processed", t: NOW } });
    expect(first.summary).toMatchObject({ found: 1, sent: 1, created: 1 });

    const second = run([message("m1", ALERTS.directv)], () => ok("created"), first.state);
    expect(second.load).not.toHaveBeenCalled();
    expect(second.send).not.toHaveBeenCalled();
    expect(second.summary).toMatchObject({ found: 1, known: 1, sent: 0 });
  });

  it("without a connection leaves the message unmarked and sends it in the next run", () => {
    const offline = run([message("m1", ALERTS.directv)], () => { throw new Error("DNS error: al-corte.example"); });
    expect(offline.state).toEqual({});
    expect(offline.summary).toMatchObject({ retry: 1, sent: 0 });

    const online = run([message("m1", ALERTS.directv)], () => ok("created"), offline.state);
    expect(online.send).toHaveBeenCalledTimes(1);
    expect(online.state).toEqual({ m1: { s: "processed", t: NOW } });
  });

  it("stops the run on answers that would repeat for every message", () => {
    for (const status of [401, 403, 429, 503]) {
      const { send, state, summary } = run([message("m1", ALERTS.directv), message("m2", ALERTS.chatgpt)], () => ({ status, body: "{}" }));
      expect(send).toHaveBeenCalledTimes(1);
      expect(state).toEqual({});
      expect(summary).toMatchObject({ retry: 2, [`http_${status}`]: 1 });
    }
  });

  it("keeps going after an isolated server error", () => {
    const { send, state, summary } = run([message("m1", ALERTS.directv), message("m2", ALERTS.chatgpt)], (request) => (request.body.includes("m1") ? { status: 500, body: "{}" } : ok("created")));
    expect(send).toHaveBeenCalledTimes(2);
    expect(state).toEqual({ m2: { s: "processed", t: NOW } });
    expect(summary).toMatchObject({ retry: 1, created: 1, http_500: 1 });
  });

  it("marks 400 and 413 as rejected", () => {
    const { state, summary } = run([message("m1", ALERTS.directv), message("m2", ALERTS.chatgpt)], (request) => ({ status: request.body.includes("m1") ? 400 : 413, body: "{}" }));
    expect(state).toEqual({ m1: { s: "rejected", t: NOW }, m2: { s: "rejected", t: NOW } });
    expect(summary).toMatchObject({ rejected: 2 });
  });

  it("never sends savings, debit, forged or foreign messages and remembers them", () => {
    const messages = [
      message("s", ALERTS.savings),
      message("d", ALERTS.debit),
      message("f", ALERTS.directv, { headers: headers([GOOGLE_FAIL, GOOGLE_PASS]) }),
      message("o", ALERTS.directv, { headers: headers(undefined, "x@otro.example") }),
    ];
    const { send, state, summary } = run(messages, () => ok("created"));
    expect(send).not.toHaveBeenCalled();
    expect(state).toEqual({ s: { s: "discarded", t: NOW }, d: { s: "discarded", t: NOW }, f: { s: "rejected", t: NOW }, o: { s: "rejected", t: NOW } });
    expect(summary).toMatchObject({ found: 4, sent: 0, discarded: 2, rejected: 2, no_credit_card: 2, dkim: 1, sender: 1 });
  });

  it("leaves a message that cannot be read for the next run", () => {
    const { state, summary } = run([message("m1", ALERTS.directv)], () => ok("created"));
    expect(state).toEqual({ m1: { s: "processed", t: NOW } });
    const failing = core.processMessages(["m2"], {}, { nowSeconds: () => NOW, load: () => { throw new Error("Gmail quota"); }, sign: nodeSign, send: () => ok("created") });
    expect(plain(failing.state)).toEqual({});
    expect(plain(failing.summary)).toMatchObject({ retry: 1, load_error: 1 });
    expect(summary).toMatchObject({ created: 1 });
  });
});

describe("first reading of the last 10 days", () => {
  const since14Nov = Date.UTC(2026, 10, 14, 5) / 1000;

  it("searches from midnight in Bogotá 10 days before today", () => {
    expect(core.backfillQuery(Date.UTC(2026, 10, 24, 15), 10)).toBe(`${SEARCH_FROM} after:${since14Nov}`);
    // 22:00 of 24 Nov in Bogotá is already 25 Nov in UTC; it is still the 24th for the owner.
    expect(core.backfillQuery(Date.UTC(2026, 10, 25, 3), 10)).toBe(`${SEARCH_FROM} after:${since14Nov}`);
    // 00:30 of 1 Dec in Bogotá goes back across the month.
    expect(core.backfillQuery(Date.UTC(2026, 11, 1, 5, 30), 10)).toContain(`after:${Date.UTC(2026, 10, 21, 5) / 1000}`);
  });

  it("evaluates again the discarded messages, but not the processed or rejected ones", () => {
    const state: CaptureState = { s: { s: "discarded", t: NOW }, p: { s: "processed", t: NOW }, r: { s: "rejected", t: NOW } };
    const messages = [message("s", ALERTS.directv.replace("T.Cred *", "T.Credito *")), message("p", ALERTS.chatgpt), message("r", ALERTS.dollars)];
    const byId = new Map(messages.map((item) => [item.id, item]));
    const send = vi.fn(() => ok("created"));
    const result = core.processMessages(["s", "p", "r"], state, { nowSeconds: () => NOW, load: (id) => byId.get(id)!, sign: nodeSign, send }, { retryDiscarded: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(plain(result.state)).toEqual({ s: { s: "processed", t: NOW }, p: { s: "processed", t: NOW }, r: { s: "rejected", t: NOW } });
    expect(plain(result.summary)).toMatchObject({ found: 3, known: 2, created: 1 });

    const hourly = core.processMessages(["s"], state, { nowSeconds: () => NOW, load: (id) => byId.get(id)!, sign: nodeSign, send });
    expect(plain(hourly.summary)).toMatchObject({ known: 1, sent: 0 });
  });

  it("stops before the time limit and keeps what it already did", () => {
    let calls = 0;
    const messages = [message("m1", ALERTS.directv), message("m2", ALERTS.chatgpt), message("m3", ALERTS.dollars)];
    const byId = new Map(messages.map((item) => [item.id, item]));
    const result = core.processMessages(["m1", "m2", "m3"], {}, { nowSeconds: () => NOW, load: (id) => byId.get(id)!, sign: nodeSign, send: () => ok("created") }, { canContinue: () => ++calls <= 1 });
    expect(plain(result.state)).toEqual({ m1: { s: "processed", t: NOW } });
    expect(plain(result.summary)).toMatchObject({ created: 1, retry: 2, time_limit: 1 });
  });
});

describe("state kept in PropertiesService", () => {
  it("parses saved state and tolerates missing or broken values", () => {
    expect(plain(core.parseState(null))).toEqual({});
    expect(plain(core.parseState("not json"))).toEqual({});
    expect(plain(core.parseState("[1,2]"))).toEqual({});
    expect(plain(core.parseState(JSON.stringify({ a: { s: "processed", t: NOW } })))).toEqual({ a: { s: "processed", t: NOW } });
  });

  it("forgets entries older than 2 days and malformed ones", () => {
    const state = {
      fresh: { s: "processed", t: NOW - core.RETENTION_SECONDS },
      old: { s: "processed", t: NOW - core.RETENTION_SECONDS - 1 },
      broken: { s: "processed" },
      wrong: { s: "other", t: NOW },
    } as unknown as CaptureState;
    expect(plain(core.pruneState(state, NOW))).toEqual({ fresh: { s: "processed", t: NOW - core.RETENTION_SECONDS } });
    expect(core.RETENTION_SECONDS).toBe(2 * 24 * 60 * 60);
  });
});

describe("helpers", () => {
  it("reads the sender address", () => {
    expect(core.senderAddress(FROM)).toBe("alertasynotificaciones@notificacionesbancolombia.com");
    expect(core.senderAddress(" ALERTAS@Example.com ")).toBe("alertas@example.com");
  });

  it("reads the charset of a part", () => {
    expect(core.partCharset([{ name: "Content-Type", value: "text/plain; charset=\"ISO-8859-1\"" }])).toBe("ISO-8859-1");
    expect(core.partCharset([{ name: "content-type", value: "text/html; charset=utf-8; format=flowed" }])).toBe("utf-8");
    expect(core.partCharset([])).toBe("UTF-8");
  });

  it("converts the signed bytes of Apps Script to hex", () => {
    expect(core.bytesToHex([0, 15, 16, 127, -128, -1])).toBe("000f107f80ff");
  });

  it("searches the three alert senders of the last 2 days", () => {
    expect(core.SEARCH_QUERY).toBe(`${SEARCH_FROM} newer_than:2d`);
    expect(core.SENDERS).toHaveLength(3);
  });

  it("summarizes a run with counts only", () => {
    const { summary } = run([message("m1", ALERTS.directv), message("m2", ALERTS.savings)], () => ok("created"));
    const text = core.describeSummary(summary);
    expect(text).toContain("encontrados=2");
    expect(text).toContain("enviados=1");
    expect(text).not.toContain("DIRECTV");
    expect(text).not.toContain("m1");
  });
});
