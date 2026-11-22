import { describe, expect, it } from "vitest";
import { latestByMerchant, merchantHistorySince, normalizeMerchant, recentMerchantNames, suggestFromHistory, type MerchantHistoryRow } from "@/lib/domain/merchant-suggestions";

const visa = "visa";
const master = "master";
const row = (overrides: Partial<MerchantHistoryRow>): MerchantHistoryRow => ({
  id: "t1", merchant: "Netflix", cardId: visa, date: "2026-11-07", createdAt: "2026-11-07T10:00:00Z", type: "purchase",
  categoryId: "subs", installmentsCount: 1, currency: "COP", isInternational: false, interestFree: false, ...overrides,
});

describe("normalizeMerchant (R11, D53)", () => {
  it("treats case, accents and trailing spaces as the same merchant", () => {
    const expected = "dlo*netflix.com";
    expect(normalizeMerchant("DLO*NETFLIX.COM")).toBe(expected);
    expect(normalizeMerchant("dlo*netflix.com ")).toBe(expected);
    expect(normalizeMerchant("Dlo*Nétflix.com")).toBe(expected);
  });

  it("keeps prefixes that distinguish merchants", () => {
    expect(normalizeMerchant("GOOGLE *ChatGPT")).toBe("google *chatgpt");
    expect(normalizeMerchant("GOOGLE *ChatGPT")).not.toBe(normalizeMerchant("ChatGPT"));
  });

  it("collapses repeated signs and inner spaces", () => {
    expect(normalizeMerchant("  Éxito   Calle  80 ")).toBe("exito calle 80");
    expect(normalizeMerchant("GOOGLE **ChatGPT")).toBe("google *chatgpt");
    expect(normalizeMerchant("Rappi!!..")).toBe("rappi!.");
    expect(normalizeMerchant("Panadería\tLa\nÑ")).toBe("panaderia la n");
  });

  it("returns an empty name for blank input", () => {
    expect(normalizeMerchant("   ")).toBe("");
  });
});

describe("merchantHistorySince", () => {
  it("looks back twelve months from today in Bogotá", () => {
    expect(merchantHistorySince("2026-11-21")).toBe("2025-11-21");
    expect(merchantHistorySince("2028-02-29")).toBe("2027-02-28");
  });
});

describe("latestByMerchant", () => {
  it("keeps the most recent row per type, normalized name and card", () => {
    const rows = [
      row({ id: "a", date: "2026-10-07", categoryId: "old" }),
      row({ id: "b", merchant: "NETFLIX ", date: "2026-11-07", categoryId: "new" }),
      row({ id: "c", cardId: master, date: "2026-09-07" }),
      row({ id: "d", type: "cash_advance", date: "2026-08-07" }),
      row({ id: "e", merchant: "  ", date: "2026-11-20" }),
    ];
    const latest = latestByMerchant(rows);
    expect(latest.map((item) => item.id)).toEqual(["b", "c", "d"]);
  });

  it("breaks same-day ties by creation time and then by id", () => {
    const rows = [
      row({ id: "a", createdAt: "2026-11-07T09:00:00Z" }),
      row({ id: "b", createdAt: "2026-11-07T11:00:00Z" }),
      row({ id: "c", createdAt: "2026-11-07T11:00:00Z" }),
    ];
    expect(latestByMerchant(rows).map((item) => item.id)).toEqual(["c"]);
    expect(latestByMerchant([...rows].reverse()).map((item) => item.id)).toEqual(["c"]);
  });
});

describe("suggestFromHistory (R11, D53)", () => {
  const active = [visa, master];

  it("prefers the same card over a more recent purchase on another card", () => {
    const history = [
      row({ id: "other", cardId: master, date: "2026-11-15", installmentsCount: 3 }),
      row({ id: "same", cardId: visa, date: "2026-10-07", installmentsCount: 2 }),
    ];
    expect(suggestFromHistory({ merchant: "netflix", cardId: visa, type: "purchase" }, history, active)?.id).toBe("same");
  });

  it("falls back to the most recent purchase on any active card", () => {
    const history = [
      row({ id: "older", cardId: master, date: "2026-09-07" }),
      row({ id: "newer", cardId: master, date: "2026-10-07" }),
      row({ id: "archived", cardId: "archived-card", date: "2026-11-01" }),
    ];
    expect(suggestFromHistory({ merchant: "Nétflix", cardId: visa, type: "purchase" }, history, active)?.id).toBe("newer");
  });

  it("only suggests from the same movement type", () => {
    const history = [row({ id: "advance", type: "cash_advance", merchant: "Cajero" })];
    expect(suggestFromHistory({ merchant: "cajero", cardId: visa, type: "purchase" }, history, active)).toBeNull();
    expect(suggestFromHistory({ merchant: "cajero", cardId: visa, type: "cash_advance" }, history, active)?.id).toBe("advance");
  });

  it("returns nothing for unknown or blank merchants and for types without suggestions", () => {
    const history = [row({})];
    expect(suggestFromHistory({ merchant: "Spotify", cardId: visa, type: "purchase" }, history, active)).toBeNull();
    expect(suggestFromHistory({ merchant: " ", cardId: visa, type: "purchase" }, history, active)).toBeNull();
    expect(suggestFromHistory({ merchant: "Netflix", cardId: visa, type: "refund" }, history, active)).toBeNull();
  });

  it("does not match prefixed names with the bare name", () => {
    const history = [row({ merchant: "GOOGLE *ChatGPT" })];
    expect(suggestFromHistory({ merchant: "ChatGPT", cardId: visa, type: "purchase" }, history, active)).toBeNull();
    expect(suggestFromHistory({ merchant: "google *chatgpt", cardId: visa, type: "purchase" }, history, active)).not.toBeNull();
  });
});

describe("recentMerchantNames", () => {
  it("lists each normalized name once, most recent first, with its latest spelling", () => {
    const history = [
      row({ id: "a", merchant: "NETFLIX", date: "2026-10-07" }),
      row({ id: "b", merchant: "Netflix", date: "2026-11-07", cardId: master }),
      row({ id: "c", merchant: "Rappi", date: "2026-11-01" }),
      row({ id: "d", merchant: "Cajero", date: "2026-11-10", type: "cash_advance" }),
      row({ id: "e", merchant: " ", date: "2026-11-11" }),
    ];
    expect(recentMerchantNames(history)).toEqual(["Cajero", "Netflix", "Rappi"]);
    expect(recentMerchantNames(history, 2)).toEqual(["Cajero", "Netflix"]);
  });
});
