import { beforeEach, expect, it, vi } from "vitest";

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
import { revalidateFinancialViews } from "@/lib/revalidate-views";

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
