import { beforeEach, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { revalidateCaptureViews, revalidateFinancialViews, revalidateStatementViews } from "@/lib/revalidate-views";

beforeEach(() => revalidatePath.mockClear());

it("invalidates every affected route pattern including old and new payment months", () => {
  revalidateFinancialViews();
  expect(revalidatePath).toHaveBeenCalledWith("/");
  expect(revalidatePath).toHaveBeenCalledWith("/movimientos");
  expect(revalidatePath).toHaveBeenCalledWith("/meses/[mes]", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/tarjetas/[id]", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/tarjetas/[id]/extractos/[cutoff]", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/movimientos/[id]", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/movimientos/nuevo");
  expect(revalidatePath).toHaveBeenCalledWith("/movimientos/[id]/editar", "page");
});

it("also invalidates the new interface under /v2 (D63)", () => {
  revalidateFinancialViews();
  expect(revalidatePath).toHaveBeenCalledWith("/v2", "layout");
  expect(revalidatePath).toHaveBeenCalledWith("/v2");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/tarjetas");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/meses/[mes]", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/tarjetas/[id]/extractos/[cutoff]", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/tarjetas/[id]/extractos/[cutoff]/conciliar", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/movimientos/[id]/editar", "page");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/por-confirmar");
});

it("invalidates the statement, its card and its payment month in both interfaces", () => {
  revalidateStatementViews({ card_id: "c1", cutoff_date: "2026-11-15", due_date: "2026-12-02" });
  for (const base of ["", "/v2"]) {
    expect(revalidatePath).toHaveBeenCalledWith(`${base}/tarjetas/c1`);
    expect(revalidatePath).toHaveBeenCalledWith(`${base}/tarjetas/c1/extractos/2026-11-15`);
    expect(revalidatePath).toHaveBeenCalledWith(`${base}/meses/2026-12`);
  }
  expect(revalidatePath).toHaveBeenCalledWith("/");
  expect(revalidatePath).toHaveBeenCalledWith("/v2");
  expect(revalidatePath).toHaveBeenCalledWith("/v2/meses/[mes]", "page");
});

it("invalidates capture settings in both interfaces", () => {
  revalidateCaptureViews();
  for (const path of ["/ajustes", "/", "/por-confirmar", "/v2/ajustes", "/v2", "/v2/por-confirmar"]) expect(revalidatePath).toHaveBeenCalledWith(path);
});
