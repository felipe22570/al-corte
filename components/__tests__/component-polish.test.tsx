import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import DesignPage from "@/app/diseno/page";
import { DesignControlsPreview } from "@/components/design-controls-preview";
import { DesignSheetPreview } from "@/components/design-sheet-preview";
import { StatusBadge } from "@/components/status-badge";

describe("status badge sizing", () => {
  it.each(["ok", "warning", "danger", "neutral"] as const)("keeps a %s badge compact without overflowing long text", (tone) => {
    const html = renderToStaticMarkup(<StatusBadge tone={tone} text="Pendiente de revisión del extracto" />);
    expect(html).toContain("w-fit");
    expect(html).toContain("max-w-full");
    expect(html).toContain("wrap-anywhere");
    expect(html).toContain("Pendiente de revisión del extracto");
  });
});

describe("development component catalogue", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("includes the shared controls and their error, disabled, and long-label states", () => {
    const html = renderToStaticMarkup(<DesignControlsPreview />);
    expect(html).toContain("Tarjeta con nombre largo");
    expect(html).toContain('id="design-card-disabled"');
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="design-card-error-message"');
    expect(html).toContain('id="design-card-error-message"');
    expect(html).toContain("Abrir calendario: Fecha de ejemplo");
    expect(html).toContain('name="example-month"');
    expect(html).toContain("Opciones del ejemplo");
  });

  it("offers a local-only sheet example without a business action", () => {
    const html = renderToStaticMarkup(<DesignSheetPreview />);
    expect(html).toContain("Abrir formulario de ejemplo");
    expect(html).toContain("No guarda datos de negocio.");
    expect(html).not.toContain("<form");
  });

  it("renders the new examples in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    const html = renderToStaticMarkup(DesignPage());
    for (const heading of ["Estados en columna", "Selectores", "Fechas y mes", "Desplegables", "Formulario lateral"]) {
      expect(html).toContain(heading);
    }
  });

  it("does not expose the catalogue in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => DesignPage()).toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});
