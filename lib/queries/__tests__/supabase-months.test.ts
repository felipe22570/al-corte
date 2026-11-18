import { describe, expect, it, vi } from "vitest";
import { createSupabaseMonthSource } from "../supabase-months";

describe("createSupabaseMonthSource", () => {
  it("uses the most recent USD movement if no fx_rates row exists", async () => {
    const calls: string[] = [];
    const client = {
      from(table: string) {
        calls.push(table);
        const query = {
          select: () => query, eq: () => query, not: () => query,
          order: () => query, limit: () => query,
          maybeSingle: async () => ({ data: table === "fx_rates" ? null : { fx_rate: "4000.25" }, error: null }),
        };
        return query;
      },
    };
    const source = createSupabaseMonthSource(client as never, "user");
    expect((await source.loadFxRate())?.toString()).toBe("4000.25");
    expect(calls).toEqual(["fx_rates", "transactions"]);
  });

  it("does not issue charge queries when there are no statement ids", async () => {
    const from = vi.fn();
    const source = createSupabaseMonthSource({ from } as never, "user");
    expect(await source.loadCharges([])).toEqual({ movements: [], installments: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("paginates statement metadata and preserves original installment categories and exact amounts", async () => {
    const statements = Array.from({ length: 1001 }, (_, index) => ({
      id: `s${index}`, card_id: "card", period_start: "2026-01-01", cutoff_date: "2026-01-15",
      due_date: "2026-02-02",
    }));
    const ranges: Array<[string, number, number]> = [];
    const client = {
      from(table: string) {
        let fields = "";
        const query = {
          select(value: string) { fields = value; return query; },
          eq: () => query, in: () => query, order: () => query,
          async range(from: number, to: number) {
            ranges.push([table, from, to]);
            const rows = table === "statements" ? statements
              : table === "statement_balances" ? [{ statement_id: "s0", currency: "COP", paid_at: "2026-02-01T05:00:00Z" }, { statement_id: "s1", currency: "COP", paid_at: "2026-02-01T05:00:00Z" }]
              : table === "statement_currency_totals" ? [
                { statement_id: "s0", currency: "COP", has_charges: true, pending_principal: "300000" },
                { statement_id: "s0", currency: "USD", has_charges: true, pending_principal: "5.5" },
                { statement_id: "s1", currency: "COP", has_charges: true, pending_principal: "0" },
                { statement_id: "s1", currency: "USD", has_charges: false, pending_principal: "2" },
              ]
              : table === "installments" ? [{ id: "i", statement_id: "s0", transaction_id: "t", total_cop: "100000.25", total: "100000.25", principal: "100000.25", balance_after: "200000.5" }]
                : fields.startsWith("id,category_id") ? [{ id: "t", category_id: "category", date: "2026-08-01", rate_ea_applied: "0.2899", interest_free: false, currency: "COP", fx_rate: null }] : [];
            return { data: rows.slice(from, to + 1), error: null };
          },
        };
        return query;
      },
    };
    const source = createSupabaseMonthSource(client as never, "user");
    const loaded = await source.loadStatements();
    expect(loaded).toHaveLength(1001);
    // D33: COP marked but USD charges pending; a USD row without charges does not block the payment mark.
    expect(loaded[0]).toMatchObject({ paidAt: null, paidByCurrency: { COP: "2026-02-01T05:00:00Z", USD: null } });
    expect(loaded[0]?.pendingPrincipal?.USD?.toString()).toBe("5.5");
    expect(loaded[1]?.paidAt).toBe("2026-02-01T05:00:00Z");
    expect(loaded[2]).toMatchObject({ paidAt: null, pendingPrincipal: {} });
    expect(ranges).toContainEqual(["statements", 1000, 1999]);
    const charges = await source.loadCharges(["s0"]);
    expect(charges.installments[0]?.categoryId).toBe("category");
    expect(charges.installments[0]?.totalCop.toString()).toBe("100000.25");
    expect(charges.installments[0]?.currency).toBe("COP");
    expect(charges.installments[0]?.interestBasis).toMatchObject({ purchaseDate: "2026-08-01", interestFree: false, currency: "COP", fxRate: null });
    expect(charges.installments[0]?.interestBasis?.balanceAfter.toString()).toBe("200000.5");
    expect(charges.installments[0]?.interestBasis?.rateEa?.toString()).toBe("0.2899");
  });
});
