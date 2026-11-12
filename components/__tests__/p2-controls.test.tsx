import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateInput } from "@/components/date-input";
import { HistoryFilters } from "@/components/history-filters";
import { buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

describe("shared controls", () => {
  it("normalizes outline borders for links as well as buttons", () => {
    const classes = buttonVariants({ variant: "outline" }).split(" ");
    expect(classes).toContain("border-border");
    expect(classes).not.toContain("border-transparent");
    expect(buttonVariants()).toContain("border-transparent");
    expect(buttonVariants({ className: "h-9" })).not.toMatch(/(?:^| )h-10(?: |$)/);
  });
  it("keeps desktop sizes distinct while allowing coarse-pointer targets", () => {
    expect(buttonVariants({ size: "sm" })).toContain("h-9");
    expect(buttonVariants()).toContain("h-10");
    expect(buttonVariants({ size: "sm" })).toContain("pointer-coarse:h-11");
    expect(buttonVariants({ size: "icon-sm" })).toContain("size-9");
    expect(buttonVariants({ size: "icon-sm" })).toContain("pointer-coarse:size-11");
    const html = renderToStaticMarkup(<NativeSelect aria-label="Tema"><option>Claro</option></NativeSelect>);
    expect(html).toContain("h-10");
    expect(html).toContain("pointer-coarse:h-11");
    expect(html).toContain("<select");
  });
  it("renders an explicit date format and keeps a native calendar available", () => {
    const html = renderToStaticMarkup(<DateInput id="date" value="2026-11-12" onValueChange={() => {}} calendarLabel="Fecha de prueba" aria-describedby="error" />);
    expect(html).toContain('value="12/11/2026"');
    expect(html).toContain('aria-describedby="error date-format"');
    expect(html).toContain("Día/mes/año");
    expect(html).toContain('type="date"');
    expect(html).toContain("Abrir calendario: Fecha de prueba");
  });
});

describe("history filter context", () => {
  it("keeps month, count, and all applied filters outside the closed disclosure", () => {
    const html = renderToStaticMarkup(<HistoryFilters filters={{ mes: "2026-11", tarjeta: "card", categoria: "category", tipo: "purchase", q: "portátil" }} cards={[{ id: "card", name: "Visa", last4: "1234", color: "card-1" }]} categories={[{ id: "category", name: "Tecnología", icon: null }]} count={23} />);
    const visibleContext = html.slice(0, html.indexOf("<details"));
    for (const text of ["Noviembre 2026", "23 movimientos", "Visa", "Tecnología", "Compra", "Búsqueda: portátil"]) expect(visibleContext).toContain(text);
    expect(html).toContain("Filtros (4)");
    expect(html).not.toContain('type="month"');
    expect(html).toContain('name="mes"');
    expect(html).not.toContain('name="pagina"');
  });
  it("handles a single result and a month-only query", () => {
    const html = renderToStaticMarkup(<HistoryFilters filters={{ mes: "2026-01" }} cards={[]} categories={[]} count={1} />);
    expect(html).toContain("Enero 2026");
    expect(html).toContain("1 movimiento");
    expect(html).not.toContain("Filtros (0)");
  });
});
