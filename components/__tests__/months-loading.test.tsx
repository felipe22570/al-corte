import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MonthsLoading from "@/app/(app)/(months)/loading";

describe("months loading", () => {
  it("announces loading and respects reduced motion", () => {
    const html = renderToStaticMarkup(<MonthsLoading />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Cargando meses"');
    expect(html).toContain("motion-safe:animate-pulse");
  });
});
