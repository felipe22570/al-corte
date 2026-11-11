import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/domain/dates", () => ({ todayInBogota: () => "2026-11-11" }));
import { GET } from "@/app/(app)/ajustes/exportar/route";

beforeEach(() => vi.clearAllMocks());

function setup(user: { id: string } | null, fail = false) {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn() };
  query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query);
  query.range.mockResolvedValue(fail ? { data: null, error: new Error("database") } : { data: [{ id: "one", credit_limit: "1234567.89" }], error: null });
  const from = vi.fn(() => query);
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from });
  return { from, query };
}

describe("data export", () => {
  it("requires authentication and rejects unsupported requests", async () => {
    setup(null);
    expect((await GET(new Request("http://localhost/ajustes/exportar?formato=json"))).status).toBe(401);
    setup({ id: "owner" });
    expect((await GET(new Request("http://localhost/ajustes/exportar?formato=csv&tabla=auth.users"))).status).toBe(400);
  });
  it("filters every table by owner and exports decimals as strings", async () => {
    const { from, query } = setup({ id: "owner" });
    const response = await GET(new Request("http://localhost/ajustes/exportar?formato=json"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.tables.cards[0].credit_limit).toBe("1234567.89");
    expect(from).toHaveBeenCalledTimes(8);
    expect(query.eq).toHaveBeenCalledTimes(7);
    expect(query.eq).toHaveBeenCalledWith("user_id", "owner");
  });
  it("sends CSV with a BOM and fails closed on query error", async () => {
    setup({ id: "owner" });
    const response = await GET(new Request("http://localhost/ajustes/exportar?formato=csv&tabla=cards"));
    expect(response.headers.get("content-disposition")).toContain("al-corte-cards-2026-11-11.csv");
    expect(new Uint8Array(await response.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([239, 187, 191]));
    setup({ id: "owner" }, true);
    expect((await GET(new Request("http://localhost/ajustes/exportar?formato=json"))).status).toBe(500);
  });
});
