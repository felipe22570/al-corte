import { describe, expect, it } from "vitest";
import { createRoutes, revalidationPatterns, safeInternalPath, v2Routes } from "@/lib/routes";

describe("app routes", () => {
  it("builds every screen of the new interface under /v2", () => {
    expect(v2Routes.home).toBe("/v2");
    expect(v2Routes.months).toBe("/v2/meses");
    expect(v2Routes.month("2026-12")).toBe("/v2/meses/2026-12");
    expect(v2Routes.cards).toBe("/v2/tarjetas");
    expect(v2Routes.card("c1")).toBe("/v2/tarjetas/c1");
    expect(v2Routes.statement("c1", "2026-11-15")).toBe("/v2/tarjetas/c1/extractos/2026-11-15");
    expect(v2Routes.statementPayment("c1", "2026-11-15")).toBe("/v2/tarjetas/c1/extractos/2026-11-15/pago");
    expect(v2Routes.statementReconcile("c1", "2026-11-15")).toBe("/v2/tarjetas/c1/extractos/2026-11-15/conciliar");
    expect(v2Routes.movements()).toBe("/v2/movimientos");
    expect(v2Routes.movements({ mes: "2026-11", tarjeta: "c1", q: "", tipo: undefined, pagina: 2 })).toBe("/v2/movimientos?mes=2026-11&tarjeta=c1&pagina=2");
    expect(v2Routes.movement("t1")).toBe("/v2/movimientos/t1");
    expect(v2Routes.editMovement("t1")).toBe("/v2/movimientos/t1/editar");
    expect(v2Routes.newMovement()).toBe("/v2/movimientos/nuevo");
    expect(v2Routes.newMovement({ draftId: "d1" })).toBe("/v2/movimientos/nuevo?borrador=d1");
    expect(v2Routes.drafts).toBe("/v2/por-confirmar");
    expect(v2Routes.subscriptions).toBe("/v2/suscripciones");
    expect(v2Routes.subscription("s1")).toBe("/v2/suscripciones#suscripcion-s1");
    expect(v2Routes.settings).toBe("/v2/ajustes");
    expect(v2Routes.newCard).toBe("/v2/ajustes/tarjetas/nueva");
    expect(v2Routes.editCard("c1")).toBe("/v2/ajustes/tarjetas/c1");
    expect(v2Routes.importStatement).toBe("/v2/ajustes/importar");
  });

  it("moves to the root by changing only the base, keeping shared routes", () => {
    const root = createRoutes("");
    expect(root.home).toBe("/");
    expect(root.month("2026-12")).toBe("/meses/2026-12");
    expect(root.newMovement({ draftId: "d1" })).toBe("/movimientos/nuevo?borrador=d1");
    expect(root.exportData({ formato: "csv", tabla: "cards" })).toBe("/ajustes/exportar?formato=csv&tabla=cards");
    expect(v2Routes.exportData({ formato: "json" })).toBe("/ajustes/exportar?formato=json");
    expect(v2Routes.login).toBe("/login");
  });

  it("lists the revalidation patterns of each interface", () => {
    const current = revalidationPatterns("");
    expect(current).toContainEqual({ path: "/" });
    expect(current).toContainEqual({ path: "/tarjetas/[id]/extractos/[cutoff]", type: "page" });
    expect(current.every(({ path }) => !path.startsWith("/v2"))).toBe(true);
    const next = revalidationPatterns("/v2");
    expect(next[0]).toEqual({ path: "/v2", type: "layout" });
    expect(next).toContainEqual({ path: "/v2/meses/[mes]", type: "page" });
    expect(next).toContainEqual({ path: "/v2/tarjetas/[id]/extractos/[cutoff]/pago", type: "page" });
    expect(next.filter(({ path }) => path.includes("[")).every(({ type }) => type === "page")).toBe(true);
    expect(next.every(({ path }) => path.startsWith("/v2"))).toBe(true);
  });
});

describe("safe internal path", () => {
  it("keeps internal paths with their query and fragment", () => {
    expect(safeInternalPath("/v2/tarjetas/c1", "/")).toBe("/v2/tarjetas/c1");
    expect(safeInternalPath("/movimientos?mes=2026-11#x", "/")).toBe("/movimientos?mes=2026-11#x");
  });

  it("falls back for anything that could leave the app", () => {
    for (const value of ["https://example.com", "//example.com", "/\\example.com", "\\\\example.com", "javascript:alert(1)", "tarjetas", "", "/a\nb", "/a\u0000", 42, null, undefined, `/${"a".repeat(1100)}`]) {
      expect(safeInternalPath(value, "/v2")).toBe("/v2");
    }
  });
});
