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
      due_date: "2026-02-02", paid_at: null,
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
              : table === "installments" ? [{ id: "i", statement_id: "s0", transaction_id: "t", total_cop: "100000.25" }]
                : fields === "id,category_id" ? [{ id: "t", category_id: "category" }] : [];
            return { data: rows.slice(from, to + 1), error: null };
          },
        };
        return query;
      },
    };
    const source = createSupabaseMonthSource(client as never, "user");
    expect(await source.loadStatements()).toHaveLength(1001);
    expect(ranges).toContainEqual(["statements", 1000, 1999]);
    const charges = await source.loadCharges(["s0"]);
    expect(charges.installments[0]?.categoryId).toBe("category");
    expect(charges.installments[0]?.totalCop.toString()).toBe("100000.25");
  });
});
