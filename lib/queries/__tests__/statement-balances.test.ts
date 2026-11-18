import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";
import { loadStatementBalances, summarizeStatementBalances, type CurrencyTotalsRow } from "../statement-balances";

const row = (currency: "COP" | "USD", values: Partial<CurrencyTotalsRow>): CurrencyTotalsRow => ({
  statement_id: "s", currency, has_charges: true, single_purchases: "0", installments: "0", subscriptions: "0", cash_advances: "0", interest: "0",
  handling_fees: "0", insurance: "0", adjustments: "0", refunds: "0", payments: "0", total_calculated: "0", total_cop: "0", pending_principal: "0", total_debt: "0", ...values,
});

describe("saldos por moneda del extracto (D33)", () => {
  it("resume pago mínimo, deuda total y valores del banco por moneda", () => {
    const { summaries, paidAt } = summarizeStatementBalances({
      totals: { COP: row("COP", { total_calculated: "1178835.57", total_cop: "1178835.57", pending_principal: "2666939.29", total_debt: "3845774.86" }), USD: row("USD", { total_calculated: "8.22", total_cop: "32880", total_debt: "153.26" }) },
      marks: { COP: { statement_id: "s", currency: "COP", real_minimum: "1178836", real_total: "3845775", paid_at: "2026-12-01T05:00:00Z" } },
    });
    expect(summaries.map((summary) => [summary.currency, summary.minimum.toString(), summary.debt.toString()])).toEqual([["COP", "1178835.57", "3845774.86"], ["USD", "8.22", "153.26"]]);
    expect(summaries[0]?.realMinimum?.toString()).toBe("1178836");
    expect(summaries[1]?.equivalentCop.toString()).toBe("32880");
    expect(summaries[1]?.realTotal).toBeNull();
    expect(paidAt).toBeNull();
  });

  it("suma la estimación de intereses en su moneda y marca pagado cuando cada moneda con cargos lo está", () => {
    const estimate = { byCurrency: { COP: new Decimal("4844"), USD: new Decimal("0.16") }, copByCurrency: { COP: new Decimal("4844"), USD: new Decimal("640") }, amountCop: new Decimal("5484") };
    const { summaries, paidAt } = summarizeStatementBalances({
      totals: { COP: row("COP", { total_calculated: "100", total_debt: "300" }), USD: row("USD", { has_charges: false, pending_principal: "5", total_debt: "5" }) },
      marks: { COP: { statement_id: "s", currency: "COP", real_minimum: null, real_total: null, paid_at: "2026-12-01T05:00:00Z" } },
    }, estimate);
    expect(summaries[0]?.minimum.toString()).toBe("4944");
    expect(summaries[0]?.debt.toString()).toBe("5144");
    expect(summaries[1]?.minimum.toString()).toBe("0.16");
    expect(summaries[1]?.equivalentCop.toString()).toBe("640");
    expect(paidAt).toBeNull();
    expect(summarizeStatementBalances({ totals: { COP: row("COP", {}), USD: row("USD", { has_charges: false }) }, marks: { COP: { statement_id: "s", currency: "COP", real_minimum: null, real_total: null, paid_at: "x" } } }).paidAt).toBe("x");
  });

  it("muestra pesos aunque no haya cargos todavía", () => {
    const { summaries, paidAt } = summarizeStatementBalances(undefined);
    expect(summaries.map((summary) => summary.currency)).toEqual(["COP"]);
    expect(summaries[0]?.minimum.isZero()).toBe(true);
    expect(paidAt).toBeNull();
  });

  it("lee totales y marcas solo del usuario y de los extractos pedidos", async () => {
    const eq = vi.fn();
    const client = { from(table: string) {
      const query = { select: () => query, eq: (...args: unknown[]) => { eq(...args); return query; }, in: () => query, order: () => query,
        range: async () => ({ data: table === "statement_balances" ? [{ statement_id: "s", currency: "USD", real_minimum: "9", real_total: null, paid_at: null }] : [row("USD", { total_calculated: "8.22" })], error: null }) };
      return query;
    } };
    const data = await loadStatementBalances(client as never, "owner", ["s", "other"]);
    expect(data.get("s")?.totals.USD?.total_calculated).toBe("8.22");
    expect(data.get("s")?.marks.USD?.real_minimum).toBe("9");
    expect(data.get("other")).toEqual({ totals: {}, marks: {} });
    expect(eq).toHaveBeenCalledWith("user_id", "owner");
    expect(await loadStatementBalances(client as never, "owner", [])).toEqual(new Map());
  });
});
