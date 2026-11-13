import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DateInput } from "@/components/date-input";
import { HistoryFilters } from "@/components/history-filters";
import { buttonVariants } from "@/components/ui/button";
import { SelectControl } from "@/components/select-control";
import { DateCalendar } from "@/components/date-calendar";
import { Disclosure, DisclosureContent, DisclosureSummary } from "@/components/ui/disclosure";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";

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
    const html = renderToStaticMarkup(<SelectControl aria-label="Tema" value="light" options={[{ value: "light", label: "Claro" }]} />);
    expect(html).toContain("h-10");
    expect(html).toContain("pointer-coarse:h-11");
    expect(html).not.toContain("<select");
  });
  it("renders an explicit date format and opens a localized calendar", () => {
    const html = renderToStaticMarkup(<DateInput id="date" value="2026-11-12" onValueChange={() => {}} calendarLabel="Fecha de prueba" aria-describedby="error" />);
    expect(html).toContain('value="12/11/2026"');
    expect(html).toContain('aria-describedby="error date-format"');
    expect(html).toContain("Día/mes/año");
    expect(html).not.toContain('type="date"');
    expect(html).toContain('placeholder="dd/mm/aaaa"');
    expect(html).toContain("Abrir calendario: Fecha de prueba");
  });
  it("uses a named Base UI combobox and submits its value", () => {
    const html = renderToStaticMarkup(<SelectControl id="theme" name="theme" aria-label="Tema" value="dark" options={[{ value: "dark", label: "Oscuro" }]} />);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-label="Tema"');
    expect(html).toContain("Oscuro");
    expect(html).toContain('name="theme"');
    expect(html).toContain('value="dark"');
    expect(html).not.toContain("<select");
    const empty = renderToStaticMarkup(<SelectControl value="" options={[{ value: "", label: "Sin categoría" }]} />);
    expect(empty).toContain("Sin categoría");
    expect(empty).not.toContain("Elige una opción");
  });
  it("renders Spanish month and weekdays with one keyboard date target", () => {
    const html = renderToStaticMarkup(<DateCalendar label="Fecha" value="2028-02-29" onSelect={() => {}} />);
    expect(html).toContain("Febrero 2028");
    expect(html).toContain('aria-label="Miércoles"');
    expect(html).toContain('aria-label="29/02/2028"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(5);
    expect(html).toContain('aria-selected="true"');
    expect(html).not.toContain('aria-label="30/02/2028"');
  });
  it("keeps disclosure spacing inside the collapsed content and sheet actions outside its scroll area", () => {
    const html = renderToStaticMarkup(<Disclosure><DisclosureSummary>Opciones</DisclosureSummary><DisclosureContent>Contenido</DisclosureContent></Disclosure>);
    expect(html).not.toContain("border");
    expect(html).toContain("group/disclosure");
    const sheet = renderToStaticMarkup(<><SheetBody>Campos</SheetBody><SheetFooter>Guardar</SheetFooter></>);
    expect(sheet).toContain("overflow-y-auto");
    expect(sheet).toContain("shrink-0");
  });
});

describe("history filter context", () => {
  it("keeps month, count, and all applied filters outside the closed disclosure", () => {
    const html = renderToStaticMarkup(<HistoryFilters filters={{ mes: "2026-11", tarjeta: "card", categoria: "category", tipo: "purchase", q: "portátil" }} cards={[{ id: "card", name: "Visa", last4: "1234", color: "card-1" }]} categories={[{ id: "category", name: "Tecnología", icon: null }]} count={23} />);
    const visibleContext = html.slice(0, html.indexOf("<details"));
    for (const text of ["Noviembre 2026", "23 movimientos", "Visa", "Tecnología", "Compra", "Búsqueda: portátil"]) expect(visibleContext).toContain(text);
    expect(html).toContain("Más filtros (3)");
    expect(visibleContext).toContain('name="q"');
    expect(visibleContext).toContain('name="mes"');
    expect(visibleContext).toContain('type="submit"');
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
