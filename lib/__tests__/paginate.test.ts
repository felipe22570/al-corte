import { describe, expect, it, vi } from "vitest";
import { fetchAllPages } from "@/lib/paginate";

describe("fetchAllPages", () => {
  it("retrieves successive pages without truncating rows", async () => {
    const values = Array.from({ length: 1001 }, (_, index) => index);
    const fetchPage = vi.fn(async (from: number, to: number) => ({ data: values.slice(from, to + 1), error: null }));
    expect(await fetchAllPages(fetchPage)).toEqual(values);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
  it("propagates query failures instead of returning partial totals", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: new Error("error") }))).rejects.toThrow("No pudimos consultar el tablero.");
  });
});
