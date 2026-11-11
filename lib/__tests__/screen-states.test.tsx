import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AppError from "@/app/(app)/error";
import AuthError from "@/app/(auth)/error";
import Loading from "@/app/(app)/loading";

describe("shared screen states", () => {
  it("provides an accessible retry for app and login errors without exposing error details", () => {
    for (const Component of [AppError, AuthError]) {
      const html = renderToStaticMarkup(<Component error={new Error("private detail")} reset={vi.fn()} />);
      expect(html).toContain('role="alert"');
      expect(html).toContain("Reintentar");
      expect(html).not.toContain("private detail");
    }
  });
  it("announces loading and respects reduced motion", () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain('aria-label="Cargando"');
    expect(html).toContain("motion-safe:animate-pulse");
  });
});
