import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AppWordmark } from "@/components/app-wordmark";
import { NewExpenseFab } from "@/components/new-expense-fab";
import { PageHeader } from "@/components/page-header";

describe("app layout controls", () => {
  it("keeps the main wordmark and gives the sidebar its dedicated compact token", () => {
    const main = renderToStaticMarkup(<AppWordmark />);
    const compact = renderToStaticMarkup(<AppWordmark compact />);
    expect(main).toContain('class="font-display text-display"');
    expect(compact).toContain('class="font-display text-wordmark"');
    expect(main).toContain("Al Corte");
    expect(compact).toContain("Al Corte");
    expect(compact).not.toContain("<svg");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const token = /@utility text-wordmark\s*\{([^}]+)\}/.exec(css)?.[1];
    expect(token).toContain("font-family: var(--font-display)");
    expect(token).toContain("font-size: 24px");
    expect(token).toContain("line-height: 30px");
  });

  it("keeps the floating action mobile-only and hides its decorative icon", () => {
    const html = renderToStaticMarkup(<NewExpenseFab />);
    expect(html).toContain('href="/movimientos/nuevo"');
    expect(html).toContain("md:hidden");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("Nuevo gasto");
  });

  it("allows long titles to wrap while keeping actions grouped separately", () => {
    const html = renderToStaticMarkup(<PageHeader title="Detalle de una tarjeta con un nombre largo" subtitle="Banco y últimos cuatro dígitos" action={<><button>Editar</button><button>Consultar</button></>} />);
    expect(html).toContain("min-w-0 flex-1 basis-48");
    expect(html).toContain("break-words");
    expect(html).toContain("justify-end gap-2");
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("<button"));
    expect(html).toContain("Editar");
    expect(html).toContain("Consultar");
  });

  it("does not create an empty action container when a page has no action", () => {
    const html = renderToStaticMarkup(<PageHeader title="Movimientos" />);
    expect(html).not.toContain("ml-auto");
    expect(html).not.toContain("<button");
  });
});
