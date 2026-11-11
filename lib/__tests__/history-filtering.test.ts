import { describe, expect, it } from "vitest";
import { filterHistoryRows } from "@/lib/history-filtering";
import type { HistoryRow } from "@/lib/history-types";

const rows: HistoryRow[] = [
  { id: "a", date: "2026-11-01", merchant: "Netflix", note: "100% real", type: "purchase", amount: "100", amount_cop: "100", currency: "COP", card_id: "1", category_id: null, installments_count: 1 },
  { id: "b", date: "2026-11-02", merchant: "Mercado", note: null, type: "refund", amount: "10", amount_cop: "10", currency: "COP", card_id: "1", category_id: null, installments_count: 1 },
  { id: "c", date: "2026-10-02", merchant: "Netflix", note: null, type: "purchase", amount: "10", amount_cop: "10", currency: "COP", card_id: "1", category_id: null, installments_count: 1 },
];

describe("history row filtering", () => {
  it("combines month, type and case-insensitive text", () => {
    expect(filterHistoryRows(rows, { mes: "2026-11", tipo: "purchase", q: "NETF" }).map((row) => row.id)).toEqual(["a"]);
  });
  it("treats wildcard characters as literal text and searches notes", () => {
    expect(filterHistoryRows(rows, { mes: "2026-11", q: "%" }).map((row) => row.id)).toEqual(["a"]);
    expect(filterHistoryRows(rows, { mes: "2026-11", q: "_" })).toEqual([]);
  });
});
