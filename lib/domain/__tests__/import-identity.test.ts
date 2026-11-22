import { describe, expect, it } from "vitest";
import { classifyImportRows, type ExistingMovement, type ExistingPayment, type ImportRow } from "@/lib/domain/import-identity";

const row = (overrides: Partial<ImportRow>): ImportRow => ({
  key: "r1", cardId: "visa", type: "purchase", date: "2026-12-03", merchant: "Netflix", amount: "44900", currency: "COP", statementCutoff: "2026-12-15", ...overrides,
});
const existing = (overrides: Partial<ExistingMovement>): ExistingMovement => ({
  id: "m1", cardId: "visa", type: "purchase", date: "2026-12-03", merchant: "Netflix", amount: "44900", currency: "COP", importKey: null,
  subscriptionId: null, subscriptionName: null, statementCutoff: "2026-12-15", ...overrides,
});
const payment = (overrides: Partial<ExistingPayment>): ExistingPayment => ({ id: "p1", cardId: "visa", date: "2026-12-01", amount: "500000", currency: "COP", ...overrides });
const statusOf = (rows: ImportRow[], movements: ExistingMovement[] = [], payments: ExistingPayment[] = []) => classifyImportRows(rows, movements, payments).map((item) => [item.key, item.status, item.match?.id ?? null]);

describe("identidad en la importación mensual (R11, D55)", () => {
  it("reconoce por la clave del archivo en la misma tarjeta, aunque cambien los demás datos", () => {
    expect(statusOf([row({ merchant: "Otro nombre", amount: "1" })], [existing({ importKey: "r1", date: "2026-08-10" })])).toEqual([["r1", "registered", "m1"]]);
    expect(statusOf([row({})], [existing({ importKey: "r1", cardId: "master", merchant: "x", amount: "2" })])).toEqual([["r1", "new", null]]);
  });

  it("sin clave, reconoce tarjeta, fecha, valor, moneda y nombre normalizado", () => {
    expect(statusOf([row({ merchant: "NÉTFLIX " })], [existing({ amount: "44900.00" })])).toEqual([["r1", "registered", "m1"]]);
    expect(statusOf([row({})], [existing({ currency: "USD" })])).toEqual([["r1", "new", null]]);
  });

  it("con igual tarjeta, fecha y valor pero otro comercio es un conflicto", () => {
    const [result] = classifyImportRows([row({ merchant: "Rappi" })], [existing({})], []);
    expect(result?.status).toBe("conflict");
    expect(result?.match?.id).toBe("m1");
    expect(statusOf([row({})], [existing({ merchant: null })])).toEqual([["r1", "conflict", "m1"]]);
  });

  it("un movimiento existente solo se empareja una vez", () => {
    expect(statusOf([row({ key: "a" }), row({ key: "b" })], [existing({})])).toEqual([["a", "registered", "m1"], ["b", "new", null]]);
  });

  it("la clave gana sobre una coincidencia por datos de otra fila", () => {
    expect(statusOf([row({ key: "a" }), row({ key: "b" })], [existing({ importKey: "b" })])).toEqual([["a", "new", null], ["b", "registered", "m1"]]);
  });

  it("reconoce el cobro de una suscripción hecho por la app a 7 días o menos, con el mismo valor", () => {
    const charge = existing({ subscriptionId: "s1", subscriptionName: "Netflix", merchant: "Netflix", date: "2026-12-02" });
    expect(statusOf([row({ merchant: "DLO*NETFLIX" })], [charge])).toEqual([["r1", "registered", "m1"]]);
    expect(statusOf([row({ merchant: "DLO*NETFLIX", date: "2026-12-10" })], [charge])).toEqual([["r1", "new", null]]);
    expect(statusOf([row({ merchant: "DLO*NETFLIX", currency: "USD" })], [charge])).toEqual([["r1", "new", null]]);
  });

  it("entre dos cobros de suscripción toma el más cercano a la fecha del banco", () => {
    const far = existing({ id: "far", subscriptionId: "s1", subscriptionName: null, merchant: "Netflix", date: "2026-11-27" });
    const close = existing({ id: "close", subscriptionId: "s2", subscriptionName: null, merchant: "Netflix", date: "2026-12-04" });
    expect(statusOf([row({ merchant: "DLO*NETFLIX" })], [far, close])).toEqual([["r1", "registered", "close"]]);
  });

  it("el mismo cobro de suscripción con otro valor es conflicto solo si coincide el nombre", () => {
    const charge = existing({ subscriptionId: "s1", subscriptionName: "DirecTV", merchant: "DirecTV", amount: "83350", date: "2026-12-04" });
    const [result] = classifyImportRows([row({ merchant: "DIRECTV", amount: "140910" })], [charge], []);
    expect(result?.status).toBe("conflict");
    expect(result?.reason).toBe("subscription_amount");
    expect(statusOf([row({ merchant: "Rappi", amount: "140910" })], [charge])).toEqual([["r1", "new", null]]);
  });

  it("compara intereses, cuota de manejo y seguros por tarjeta, extracto, tipo y moneda", () => {
    const interest = existing({ type: "interest", merchant: null, date: "2026-12-15", amount: "12000" });
    expect(statusOf([row({ type: "interest", merchant: "Intereses", date: "2026-12-14", amount: "12000" })], [interest])).toEqual([["r1", "registered", "m1"]]);
    const [different] = classifyImportRows([row({ type: "interest", merchant: "Intereses", amount: "12500" })], [interest], []);
    expect(different?.status).toBe("statement_conflict");
    expect(statusOf([row({ type: "handling_fee", merchant: "Cuota de manejo", amount: "12000" })], [interest])).toEqual([["r1", "new", null]]);
    expect(statusOf([row({ type: "interest", merchant: "Intereses", amount: "12000", statementCutoff: "2027-01-15" })], [interest])).toEqual([["r1", "new", null]]);
  });

  it("los pagos nunca se importan: ya registrados o sin registrar", () => {
    const rows = [row({ key: "p-a", type: "payment", date: "2026-12-01", amount: "500000" }), row({ key: "p-b", type: "payment", date: "2026-12-02", amount: "100000" })];
    expect(statusOf(rows, [], [payment({})])).toEqual([["p-a", "payment_registered", "p1"], ["p-b", "payment_missing", null]]);
    expect(statusOf([rows[0]!, { ...rows[0]!, key: "p-c" }], [], [payment({})])).toEqual([["p-a", "payment_registered", "p1"], ["p-c", "payment_missing", null]]);
    expect(statusOf([row({ type: "payment", currency: "USD", amount: "500000", date: "2026-12-01" })], [], [payment({})])).toEqual([["r1", "payment_missing", null]]);
  });
});
