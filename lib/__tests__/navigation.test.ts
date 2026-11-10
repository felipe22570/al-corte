import { expect, it } from "vitest";
import { isNavigationActive } from "@/lib/navigation";

it("marca el tablero y sus tarjetas sin activar rutas ajenas", () => {
  expect(isNavigationActive("/", "/")).toBe(true);
  expect(isNavigationActive("/", "/tarjetas/123/extractos/2026-01-15")).toBe(true);
  expect(isNavigationActive("/", "/movimientos")).toBe(false);
});

it("reconoce rutas hijas sin confundir prefijos", () => {
  expect(isNavigationActive("/movimientos", "/movimientos/nuevo")).toBe(true);
  expect(isNavigationActive("/movimientos", "/movimientos-extra")).toBe(false);
  expect(isNavigationActive("/ajustes", "/ajustes")).toBe(true);
});
