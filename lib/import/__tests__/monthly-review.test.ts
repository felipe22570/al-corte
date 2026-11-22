import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseMonthlyFile, type MonthlyFile } from "../monthly-file";
import { buildImportRequest, buildMonthlyReview, defaultDecisions, type ImportContext } from "../monthly-review";

const card = { id: "card-visa", name: "Visa", last4: "4242", color: "card-2" as const, cutoffDay: 15, paymentDay: 2, purchaseRateEa: "0.283288", advanceRateEa: "0.283288", advanceFee: "6840", amortizationMethod: "fixed_principal" as const, interestMode: "on_balance" as const };
const context = (overrides: Partial<ImportContext> = {}): ImportContext => ({ cards: [card], categories: [{ id: "cat-subs", name: "Suscripciones" }], rates: {}, movements: [], payments: [], ...overrides });
const base = { card: "visa", category: null, currency: "COP" as const, installments_count: 1, statement_cutoff: "2026-11-15" };
function file(overrides: Partial<MonthlyFile> = {}): MonthlyFile {
  return {
    format: "al-corte-import", version: 1,
    cards: [{ key: "visa", last4: "4242", cutoff_day: 15, payment_day: 2, purchase_rate_ea: "0.283288", advance_rate_ea: "0.283288", amortization_method: "fixed_principal", interest_mode: "on_balance", bank_available_credit: "4000000.00" }],
    statements: [
      { card: "visa", cutoff_date: "2026-10-15", due_date: "2026-11-02", reference_only: true, balances: [] },
      { card: "visa", cutoff_date: "2026-11-15", due_date: "2026-12-02", balances: [{ currency: "COP", real_minimum: "150000.00", real_total: "500000.00" }] },
    ],
    transactions: [
      { ...base, key: "t-netflix", type: "purchase", date: "2026-11-07", merchant: "Netflix", category: "suscripciones", amount: "44900" },
      { ...base, key: "t-usd", type: "purchase", date: "2026-11-03", merchant: "Servicio", amount: "2.79", currency: "USD", installments_count: 36, installments_count_original: 36, fx_rate: null },
      { ...base, key: "t-avance", type: "cash_advance", date: "2026-11-05", merchant: "Avance", amount: "200000", installments_count: 2 },
      { ...base, key: "t-comision", type: "advance_fee", date: "2026-11-05", merchant: "Comisión", amount: "7200", parent: "t-avance" },
      { ...base, key: "t-borde", type: "purchase", date: "2026-10-15", merchant: "Borde", amount: "10000", statement_override: true },
      { ...base, key: "t-otro-borde", type: "purchase", date: "2026-09-15", merchant: "Viejo", amount: "10000", statement_cutoff: "2026-10-15", statement_override: true },
    ],
    payments: [{ key: "p-1", card: "visa", date: "2026-11-30", merchant: "Pago", amount: "150000", currency: "COP", applies_to_statement_cutoff: "2026-11-15" }],
    ...overrides,
  };
}

describe("lectura del archivo mensual (F22)", () => {
  it("el ejemplo de docs/import-format.md es un archivo válido", () => {
    const doc = readFileSync("docs/import-format.md", "utf8");
    const example = /```json\n([\s\S]+?)\n```/.exec(doc)?.[1];
    const parsed = parseMonthlyFile(example ?? "");
    expect(parsed.ok).toBe(true);
    const result = parsed.ok ? buildMonthlyReview(parsed.file, context({ rates: { "2026-12-05": "3300" }, categories: [{ id: "cat-hogar", name: "Hogar" }] })) : null;
    expect(result?.ok && result.review.rows.map((row) => row.status)).toEqual(["new", "new", "new", "new", "new", "payment_missing"]);
  });

  it("acepta el formato v1 y rechaza lo demás sin repetir su contenido", () => {
    expect(parseMonthlyFile(JSON.stringify(file())).ok).toBe(true);
    expect(parseMonthlyFile("{nope")).toEqual({ ok: false, error: "El archivo no es un JSON válido." });
    expect(parseMonthlyFile(JSON.stringify({ format: "otro", version: 1 }))).toEqual({ ok: false, error: "El archivo no es al-corte-import v1." });
    expect(parseMonthlyFile("null")).toEqual({ ok: false, error: "El archivo no es al-corte-import v1." });
    const bad = parseMonthlyFile(JSON.stringify({ ...file(), cards: [{ ...file().cards[0], last4: "secreto" }] }));
    expect(bad).toEqual({ ok: false, error: "El archivo no cumple el formato al-corte-import v1 (cards.0.last4)." });
    expect(JSON.stringify(bad)).not.toContain("secreto");
    expect(parseMonthlyFile(" ".repeat(1024 * 1024 + 1))).toEqual({ ok: false, error: "El archivo pesa más de 1 MB." });
    const repeated = file();
    repeated.payments[0]!.key = "t-netflix";
    expect(parseMonthlyFile(JSON.stringify(repeated))).toEqual({ ok: false, error: "El archivo repite claves de movimientos." });
  });
});

describe("revisión de la importación mensual (F22, D55)", () => {
  it("falla sin importar nada con una tarjeta no registrada o sin extracto", () => {
    expect(buildMonthlyReview(file(), context({ cards: [] }))).toEqual({ ok: false, error: "No tienes una tarjeta activa terminada en 4242. Regístrala antes de importar." });
    expect(buildMonthlyReview(file({ statements: [] }), context())).toEqual({ ok: false, error: "El archivo no trae un extracto para importar." });
    expect(buildMonthlyReview(file({ payments: [{ ...file().payments[0]!, card: "master" }] }), context())).toEqual({ ok: false, error: "El archivo usa una tarjeta que no declara." });
  });

  it("arma cada línea nueva con la tarjeta guardada, su categoría, su comisión y la TRM del día", () => {
    const result = buildMonthlyReview(file(), context({ rates: { "2026-11-03": "3300" } }));
    if (!result.ok) throw new Error(result.error);
    const rows = Object.fromEntries(result.review.rows.map((row) => [row.key, row]));
    expect(Object.keys(rows)).toEqual(["t-netflix", "t-usd", "t-avance", "t-borde", "t-otro-borde", "p-1"]);
    expect(rows["t-netflix"]?.status).toBe("new");
    expect(result.plans.get("t-netflix")?.payload.category_id).toBe("cat-subs");
    expect(result.plans.get("t-usd")?.payload.fx_rate).toBe("3300");
    expect(rows["t-usd"]?.installment).toEqual({ current: 1, count: 36 });
    expect(rows["t-avance"]?.fee).toBe("7200");
    expect(result.plans.get("t-avance")?.payload.advance_fee).toBe("7200");
    expect(result.plans.get("t-avance")?.fee).toEqual({ key: "t-comision", merchant: "Comisión" });
    expect(result.plans.get("t-borde")?.payload.statement_cutoff_override).toBe("2026-11-15");
    expect(result.plans.get("t-otro-borde")?.payload.statement_cutoff_override).toBeUndefined();
    expect(result.review.warnings).toEqual(["Viejo (2026-09-15): se ignora el extracto forzado porque no es el del archivo."]);
    expect(rows["p-1"]?.status).toBe("payment_missing");
    expect(result.review.statements).toEqual([{ cardId: "card-visa", cardName: "Visa", last4: "4242", color: "card-2", cutoffDate: "2026-11-15", dueDate: "2026-12-02", bank: [{ currency: "COP", minimum: "150000.00", total: "500000.00" }], bankAvailable: "4000000.00" }]);
  });

  it("bloquea las líneas en dólares sin TRM, las comisiones sueltas y los planes imposibles", () => {
    const transactions = [
      ...file().transactions.slice(1, 2),
      { ...base, key: "t-suelta", type: "advance_fee" as const, date: "2026-11-05", merchant: "Comisión suelta", amount: "7200" },
      { ...base, key: "t-imposible", type: "purchase" as const, date: "2026-11-05", merchant: "Mínima", amount: "0.10", installments_count: 36 },
    ];
    const result = buildMonthlyReview(file({ transactions, payments: [] }), context());
    if (!result.ok) throw new Error(result.error);
    expect(result.review.rows.map((row) => [row.key, row.status, row.blocked])).toEqual([
      ["t-usd", "blocked", "Falta la TRM del 2026-11-03."],
      ["t-suelta", "blocked", "Es una comisión sin su avance en el archivo."],
      ["t-imposible", "blocked", "El valor es muy pequeño para esa cantidad de cuotas."],
    ]);
    expect(result.plans.size).toBe(0);
  });

  it("avisa cuando las condiciones de la tarjeta del archivo son otras, sin cambiarlas", () => {
    const result = buildMonthlyReview(file({ cards: [{ ...file().cards[0]!, cutoff_day: 16, payment_day: 3, purchase_rate_ea: "0.3", amortization_method: "french", interest_mode: "per_installment" }] }), context());
    expect(result.ok && result.review.warnings[0]).toBe("La tarjeta •••• 4242 tiene en el archivo otras condiciones (corte, pago, tasas, amortización, intereses). Se usan las que tienes en Al Corte.");
  });

  it("importa las nuevas por defecto, espera la decisión en conflictos y nunca importa pagos ni registradas", () => {
    const movements = [
      { id: "m-netflix", cardId: "card-visa", type: "purchase", date: "2026-11-07", merchant: "Netflix", amount: "44900", currency: "COP" as const, importKey: null, subscriptionId: null, subscriptionName: null, statementCutoff: "2026-11-15" },
      { id: "m-otro", cardId: "card-visa", type: "purchase", date: "2026-11-05", merchant: "Cajero", amount: "200000", currency: "COP" as const, importKey: null, subscriptionId: null, subscriptionName: null, statementCutoff: "2026-11-15" },
    ];
    const result = buildMonthlyReview(file(), context({ movements, rates: { "2026-11-03": "3300" } }));
    if (!result.ok) throw new Error(result.error);
    expect(result.review.rows.find((row) => row.key === "t-avance")?.status).toBe("conflict");
    const decisions = defaultDecisions(result.review);
    expect(decisions).toEqual({ "t-usd": "import", "t-avance": "skip", "t-borde": "import", "t-otro-borde": "import" });
    const linked = buildImportRequest(result.review, result.plans, { "t-avance": "link", "t-netflix": "import", "p-1": "import" });
    expect(linked.create.map((item) => item.key)).toEqual(["t-usd", "t-borde", "t-otro-borde"]);
    expect(linked.link).toEqual([{ transaction_id: "m-otro", key: "t-avance" }]);
    expect(linked.statements).toEqual([{ card_id: "card-visa", cutoff_date: "2026-11-15", balances: [{ currency: "COP", real_minimum: "150000.00", real_total: "500000.00" }] }]);
    const asNew = buildImportRequest(result.review, result.plans, { "t-avance": "import", "t-usd": "skip", "t-borde": "link" });
    expect(asNew.create.map((item) => item.key)).toEqual(["t-avance", "t-otro-borde"]);
    expect(asNew.link).toEqual([]);
  });
});
