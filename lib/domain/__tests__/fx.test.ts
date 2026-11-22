import { describe, expect, it } from "vitest";
import { trmForStatement, type FxRate } from "@/lib/domain/fx";

// Official TRM around the cutoff of November 15, 2026 (datos.gov.co, 32sa-8pi3).
const rates: FxRate[] = [
  { date: "2026-11-12", usdCop: "3297.07", validFrom: "2026-11-11" },
  { date: "2026-11-13", usdCop: "3301.91", validFrom: "2026-11-13" },
  { date: "2026-11-14", usdCop: "3316.7", validFrom: "2026-11-14" },
  { date: "2026-11-15", usdCop: "3316.7", validFrom: "2026-11-14" },
  { date: "2026-11-16", usdCop: "3316.7", validFrom: "2026-11-14" },
  { date: "2026-11-17", usdCop: "3316.7", validFrom: "2026-11-14" },
  { date: "2026-11-18", usdCop: "3309.55", validFrom: "2026-11-18" },
];

describe("TRM del extracto (D52)", () => {
  it("usa la del último día hábil antes del corte: el día anterior al inicio del periodo que lo contiene", () => {
    expect(trmForStatement(rates, "2026-11-15")).toBe("3301.91");
  });

  it("con un corte en día hábil usa la del día anterior", () => {
    expect(trmForStatement(rates, "2026-11-18")).toBe("3316.7");
  });

  it("no inventa una TRM cuando falta el corte o el día anterior", () => {
    expect(trmForStatement(rates, "2026-12-15")).toBeNull();
    expect(trmForStatement(rates, "2026-11-12")).toBeNull();
  });
});
