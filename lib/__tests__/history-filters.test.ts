import { describe, expect, it } from "vitest";
import { parseHistoryFilters } from "@/lib/validation/history-filters";

describe("history filters", () => {
  it("ignores invalid filters and defaults to the current month", () => {
    expect(parseHistoryFilters({ mes: "2026-13", tarjeta: "wrong", tipo: "bad", pagina: "-3" }, "2026-11")).toEqual({ mes: "2026-11", tarjeta: undefined, categoria: undefined, tipo: undefined, q: undefined, pagina: 1 });
  });
  it("accepts valid filters and trims search", () => {
    expect(parseHistoryFilters({ mes: "2025-12", tarjeta: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tipo: "purchase", q: "  netf  ", pagina: "2" }, "2026-11")).toMatchObject({ mes: "2025-12", tipo: "purchase", q: "netf", pagina: 2 });
  });
});
