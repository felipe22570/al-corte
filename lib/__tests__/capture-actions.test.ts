import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
import { addCardAlias, removeCardAlias, setCaptureEnabled } from "../actions/capture";

const card = "11111111-1111-4111-8111-111111111111";
const alias = "22222222-2222-4222-8222-222222222222";

function setup(results: { card?: unknown; write?: { data?: unknown; error?: { code: string } | null } } = {}, user: { id: string } | null = { id: "owner" }) {
  const writes: Array<[string, string, unknown]> = [];
  const builder = (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq", "is"]) query[method] = () => query;
    query.maybeSingle = async () => table === "cards" ? { data: results.card ?? null, error: null } : { data: results.write && "data" in results.write ? results.write.data : { id: alias }, error: results.write?.error ?? null };
    query.upsert = (row: unknown) => (writes.push([table, "upsert", row]), Promise.resolve({ error: results.write?.error ?? null }));
    query.insert = (row: unknown) => (writes.push([table, "insert", row]), Promise.resolve({ error: results.write?.error ?? null }));
    query.delete = () => (writes.push([table, "delete", null]), query);
    return query;
  };
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, from: builder });
  return writes;
}

beforeEach(() => vi.clearAllMocks());

describe("setCaptureEnabled (D51)", () => {
  it("turns capture on and off for the session owner", async () => {
    const writes = setup();
    expect(await setCaptureEnabled(true)).toEqual({ ok: true });
    expect(writes).toEqual([["capture_settings", "upsert", { user_id: "owner", enabled: true }]]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/ajustes");
  });

  it("rejects other values, a missing session and database errors", async () => {
    expect((await setCaptureEnabled("true")).ok).toBe(false);
    setup({}, null);
    expect(await setCaptureEnabled(true)).toEqual({ ok: false, error: "Inicia sesión para continuar." });
    setup({ write: { error: { code: "XX000" } } });
    expect(await setCaptureEnabled(false)).toEqual({ ok: false, error: "No pudimos cambiar la captura. Intenta de nuevo." });
  });
});

describe("card aliases (D44)", () => {
  it("adds other last 4 digits to an active card", async () => {
    const writes = setup({ card: { last4: "1999" } });
    expect(await addCardAlias({ cardId: card, last4: " 4321 " })).toEqual({ ok: true });
    expect(writes).toEqual([["card_aliases", "insert", { user_id: "owner", card_id: card, last4: "4321" }]]);
  });

  it.each([
    [{ cardId: card, last4: "43a1" }, {}, "Escribe los últimos 4 dígitos."],
    [{ cardId: "x", last4: "4321" }, {}, "Elige una tarjeta."],
    [{ cardId: card, last4: "4321" }, { card: null }, "La tarjeta ya no está disponible."],
    [{ cardId: card, last4: "1999" }, { card: { last4: "1999" } }, "La tarjeta ya termina en esos dígitos."],
    [{ cardId: card, last4: "4321" }, { card: { last4: "1999" }, write: { error: { code: "23505" } } }, "Esos dígitos ya están asignados a una tarjeta."],
    [{ cardId: card, last4: "4321" }, { card: { last4: "1999" }, write: { error: { code: "XX000" } } }, "No pudimos guardar los dígitos. Intenta de nuevo."],
  ])("explains %o", async (input, results, error) => {
    setup(results);
    expect(await addCardAlias(input)).toEqual({ ok: false, error });
  });

  it("removes an alias of the owner", async () => {
    const writes = setup();
    expect(await removeCardAlias(alias)).toEqual({ ok: true });
    expect(writes).toEqual([["card_aliases", "delete", null]]);
    setup({ write: { data: null } });
    expect(await removeCardAlias(alias)).toEqual({ ok: false, error: "No pudimos quitar los dígitos. Intenta de nuevo." });
    expect((await removeCardAlias("x")).ok).toBe(false);
    setup({}, null);
    expect(await addCardAlias({ cardId: card, last4: "4321" })).toEqual({ ok: false, error: "Inicia sesión para continuar." });
    expect(await removeCardAlias(alias)).toEqual({ ok: false, error: "Inicia sesión para continuar." });
  });
});
