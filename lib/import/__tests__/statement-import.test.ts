import { describe, expect, it } from "vitest";
import { buildImportSql } from "../statement-import";
import { trmByDate } from "../trm";
import { syntheticImport, syntheticTrm } from "./fixture";

const options = { trm: trmByDate(syntheticTrm), advanceFees: { visa: "6840" }, trmSource: "TRM de prueba", generatedOn: "2026-11-21" };

describe("TRM oficial por fecha", () => {
  it("expande los periodos de vigencia a cada día", () => {
    expect(trmByDate(syntheticTrm)).toEqual({ "2026-10-31": "3300", "2026-11-01": "3300", "2026-11-02": "3300", "2026-11-03": "3300" });
  });
});

describe("script de importación (paso 35, D36)", () => {
  it("arma un script transaccional con la cuenta por completar y cada movimiento una sola vez", () => {
    const { sql, warnings } = buildImportSql(syntheticImport(), options);
    expect(warnings).toEqual([]);
    expect(sql.startsWith("-- Al Corte · importación de extractos reales")).toBe(true);
    expect(sql).toContain("begin;");
    expect(sql).toContain("select set_config('al_corte.email', '__PENDIENTE__', true);");
    expect(sql).toContain("set local role authenticated;");
    expect(sql.trimEnd().endsWith("reset role;\ncommit;")).toBe(true);
    for (const key of ["t-borde", "t-curso", "t-usd", "t-avance", "t-interes", "t-mensual"]) expect(sql).toContain(`import_key = '${key}') then return;`);
    // The fee goes with its advance (D41) and the border purchase keeps the bank's statement (D30).
    expect(sql).toContain('"advance_fee":"6840"');
    expect(sql).toContain("import_key = 't-comision'");
    expect(sql).toContain('"statement_cutoff_override":"2026-11-15"');
    // In progress: installment k from the bank and its statement (D49); USD with the official TRM.
    expect(sql).toContain('"prior_installments":3');
    expect(sql).toContain('"fx_rate":"3300"');
    // Escaped text and the card's pending advance fee.
    expect(sql).toContain("Nevera O''Brien");
    expect(sql).toContain("0.283288, 0.283288,\n      6840,");
    // Payments of the reference statement only mark it paid; subscriptions link their charges.
    expect(sql).not.toContain("register_payment");
    expect(sql).toContain("'COP', '2026-10-30T05:00:00Z'");
    expect(sql).toContain("import_key in ('t-usd')");
    expect(sql).toContain("'Servicio en dólares', 2.79, 'USD', 'monthly', 3,\n      '2026-11-03', 'active', 36, 2.79)");
    expect(sql).toContain("as cupo_disponible_banco");
  });

  it("avisa las diferencias con el banco", () => {
    const file = syntheticImport();
    file.transactions[1] = { ...file.transactions[1]!, installment_principal_this_statement: "99999", installments_count: 5, prior_principal_paid: "299999" };
    file.transactions[3] = { ...file.transactions[3]!, statement_cutoff: "2026-12-15" };
    const { warnings } = buildImportSql(file, options);
    expect(warnings).toEqual([
      "t-curso: plan de 6 cuotas; el archivo dice 5.",
      "t-curso: capital previo 300001; el archivo dice 299999.",
      "t-curso: cuota 4 de 100000; el banco dice 99999.",
      "t-curso: saldo 199999; el banco dice 200000.",
      "t-avance: Al Corte lo asigna al corte 2026-11-15 y el banco al 2026-12-15.",
    ]);
  });

  it("se detiene sin TRM, sin comisión por avance, con tarjetas desconocidas o con texto que rompe el script", () => {
    expect(() => buildImportSql(syntheticImport(), { ...options, trm: {} })).toThrow("Falta la TRM del 2026-11-03 para t-usd.");
    expect(() => buildImportSql(syntheticImport(), { ...options, advanceFees: {} })).toThrow("Falta la comisión por avance de la tarjeta visa.");
    expect(() => buildImportSql({ ...syntheticImport(), format: "otro" }, options)).toThrow("al-corte-import v1");
    const unknownCard = syntheticImport();
    unknownCard.transactions[0] = { ...unknownCard.transactions[0]!, card: "otra" };
    expect(() => buildImportSql(unknownCard, options)).toThrow("Tarjeta desconocida: otra.");
    const dollars = syntheticImport();
    dollars.transactions[0] = { ...dollars.transactions[0]!, merchant: "a$$b" };
    expect(() => buildImportSql(dollars, options)).toThrow('contiene "$$"');
    const unknownCharge = syntheticImport();
    unknownCharge.subscriptions[0] = { ...unknownCharge.subscriptions[0]!, first_charge: "no-existe" };
    expect(() => buildImportSql(unknownCharge, options)).toThrow("Cobro desconocido: no-existe.");
    const noStart = syntheticImport();
    noStart.pending_subscriptions![0] = { ...noStart.pending_subscriptions![0]!, charges: [] };
    expect(() => buildImportSql(noStart, options)).toThrow("no tiene fecha de inicio");
  });
});
