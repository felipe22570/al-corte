#!/usr/bin/env node
/**
 * Al Corte · prueba de la ruta de ingesta de alertas (paso 45, D51).
 *
 *   pnpm probe:ingest <url>               seguridad: firmas, tamaño, captura y repetición
 *   pnpm probe:ingest <url> --capture-off  igual, esperando 403 porque la captura está apagada en Ajustes
 *   pnpm probe:ingest <url> --rotation     tras rotar el secreto: el anterior da 401 y el nuevo 200
 *
 * El secreto se pide sin mostrarlo en pantalla (fuera de la rotación, también se lee de INGEST_PROBE_SECRET). Nunca se
 * imprime ni se guarda.
 * Solo la prueba de repetición crea un borrador: una compra ficticia de $1.000 con T.Cred *0000, que queda como
 * "Tarjeta no registrada" y se descarta en Por confirmar. Las demás solicitudes no dejan filas.
 */
import { createHmac, randomBytes } from "node:crypto";
import readline from "node:readline";

const args = process.argv.slice(2);
const url = args.find((arg) => !arg.startsWith("--"));
const mode = args.includes("--rotation") ? "rotation" : args.includes("--capture-off") ? "capture-off" : "security";
if (!url || !/^https?:\/\//.test(url)) {
  console.error("Uso: pnpm probe:ingest <url de /api/ingest/alerts> [--capture-off | --rotation]");
  process.exit(2);
}

/** One reader for every prompt, so piped input with several lines is not lost between questions. */
let lines = null;
let reader = null;
async function askHidden(question, fromEnv = false) {
  if (fromEnv && process.env.INGEST_PROBE_SECRET) return process.env.INGEST_PROBE_SECRET;
  if (!lines) {
    reader = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    // What is typed is not echoed.
    reader._writeToOutput = () => {};
    lines = reader[Symbol.asyncIterator]();
  }
  process.stdout.write(question);
  const { value } = await lines.next();
  process.stdout.write("\n");
  return String(value ?? "").trim();
}

const sign = (secret, timestamp, body) => `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`, "utf8").digest("hex")}`;
const now = () => Math.floor(Date.now() / 1000);
const today = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());

/** Not a credit card alert: the route answers "ignored" and stores nothing. */
const ignoredBody = () => JSON.stringify({ message_id: `al-corte-probe-${randomBytes(6).toString("hex")}`, phrase: "Bancolombia: prueba de firma de Al Corte, sin tarjeta de crédito." });

async function post(body, headers) {
  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body, redirect: "manual" });
    const text = await response.text();
    let result = "";
    try {
      result = JSON.parse(text).result ?? "";
    } catch {
      result = "";
    }
    return { status: response.status, result };
  } catch (error) {
    return { status: 0, result: error instanceof Error ? error.message : "sin conexión" };
  }
}

const signed = (secret, body, timestamp = now()) => post(body, { "X-Al-Corte-Timestamp": String(timestamp), "X-Al-Corte-Signature": sign(secret, String(timestamp), body) });

let failures = 0;
function report(name, got, expected) {
  const ok = got.status === expected.status && (!expected.result || got.result === expected.result);
  if (!ok) failures += 1;
  const shown = `${got.status}${got.result ? ` ${got.result}` : ""}`;
  const wanted = `${expected.status}${expected.result ? ` ${expected.result}` : ""}`;
  console.log(`${ok ? "OK   " : "FALLA"} ${name}: ${shown}${ok ? "" : ` (se esperaba ${wanted})`}`);
}

if (mode === "rotation") {
  const previous = await askHidden("Secreto ANTERIOR: ");
  const current = await askHidden("Secreto NUEVO: ");
  report("secreto anterior", await signed(previous, ignoredBody()), { status: 401 });
  report("secreto nuevo", await signed(current, ignoredBody()), { status: 200, result: "ignored" });
} else {
  const secret = await askHidden("Secreto de firma (INGEST_SIGNING_SECRET): ", true);
  const off = mode === "capture-off";
  report("sin firma", await post(ignoredBody(), {}), { status: 401 });
  report("otro secreto", await signed(randomBytes(32).toString("hex"), ignoredBody()), { status: 401 });
  report("firma de hace 6 minutos", await signed(secret, ignoredBody(), now() - 6 * 60), { status: 401 });
  report("cuerpo de 5 KB", await signed(secret, JSON.stringify({ message_id: "al-corte-probe-big", phrase: "x".repeat(5000) })), { status: 413 });
  report("firma válida, alerta sin tarjeta de crédito", await signed(secret, ignoredBody()), off ? { status: 403 } : { status: 200, result: "ignored" });
  const probe = JSON.stringify({
    message_id: `al-corte-probe-${randomBytes(6).toString("hex")}`,
    phrase: `Bancolombia: Compraste COP1.000,00 en PRUEBA AL CORTE, el ${today} a las 12:00. Esta compra esta asociada a T.Cred *0000`,
  });
  report("alerta de prueba (T.Cred *0000)", await signed(secret, probe), off ? { status: 403 } : { status: 200, result: "created" });
  report("la misma alerta otra vez", await signed(secret, probe), off ? { status: 403 } : { status: 200, result: "duplicate" });
  if (!off) console.log("Descarta en Por confirmar el borrador \"PRUEBA AL CORTE\" (Tarjeta no registrada).");
}

reader?.close();
console.log(failures ? `${failures} prueba(s) no dieron lo esperado.` : "Todo dio lo esperado.");
process.exit(failures ? 1 : 0);
