import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), revalidate: vi.fn(), buildCreatePayload: vi.fn(), loadDraftProposal: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/revalidate-views", () => ({ revalidateFinancialViews: mocks.revalidate }));
vi.mock("@/lib/transaction-create", () => ({ buildCreatePayload: mocks.buildCreatePayload }));
vi.mock("@/lib/queries/drafts", () => ({ loadDraftProposal: mocks.loadDraftProposal }));
import { confirmDraft, discardDraft, linkDraft } from "../actions/drafts";

const draftId = "55555555-5555-4555-8555-555555555555";
const transactionId = "66666666-6666-4666-8666-666666666666";

function setup(rpcResult: { data?: unknown; error?: { code: string; message: string } | null }, user: { id: string } | null = { id: "owner" }) {
  const rpc = vi.fn().mockResolvedValue({ data: rpcResult.data ?? null, error: rpcResult.error ?? null });
  mocks.createClient.mockResolvedValue({ auth: { getUser: async () => ({ data: { user } }) }, rpc });
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadDraftProposal.mockResolvedValue(null);
});

const card = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const formInput = { cardId: card, type: "purchase", date: "2026-11-17", amount: "140.910", currency: "COP", fxRate: "", installmentsCount: "1", interestFree: false, categoryId: "", merchant: "DirecTV", note: "" };
const proposal = { cardId: card, type: "purchase", amount: "140910.00", currency: "COP", merchantRaw: "DIRECTV", occurredOn: "2026-11-17", suggestions: null };

describe("confirmDraft", () => {
  it("saves the movement and resolves the draft in one RPC", async () => {
    mocks.buildCreatePayload.mockResolvedValue({ ok: true, payload: { card_id: "visa" } });
    const rpc = setup({ data: transactionId });
    expect(await confirmDraft(draftId, { amount: "1" })).toEqual({ ok: true, id: transactionId });
    expect(mocks.buildCreatePayload).toHaveBeenCalledWith(expect.anything(), "owner", { amount: "1" });
    expect(rpc).toHaveBeenCalledWith("confirm_transaction_draft", { p_draft_id: draftId, p_payload: { card_id: "visa" }, p_changed_fields: undefined });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("records the names of the fields the owner corrected (step 45)", async () => {
    mocks.buildCreatePayload.mockResolvedValue({ ok: true, payload: { card_id: card } });
    mocks.loadDraftProposal.mockResolvedValue(proposal);
    const rpc = setup({ data: transactionId });
    await confirmDraft(draftId, formInput);
    expect(mocks.loadDraftProposal).toHaveBeenCalledWith(expect.anything(), "owner", draftId);
    expect(rpc).toHaveBeenLastCalledWith("confirm_transaction_draft", { p_draft_id: draftId, p_payload: { card_id: card }, p_changed_fields: ["merchant"] });
    await confirmDraft(draftId, { ...formInput, merchant: "DIRECTV" });
    expect(rpc).toHaveBeenLastCalledWith("confirm_transaction_draft", { p_draft_id: draftId, p_payload: { card_id: card }, p_changed_fields: [] });
  });

  it("returns form errors without calling the database", async () => {
    mocks.buildCreatePayload.mockResolvedValue({ ok: false, error: "Revisa los datos del movimiento.", errors: { amount: ["Ingresa un valor."] } });
    const rpc = setup({});
    expect(await confirmDraft(draftId, {})).toEqual({ ok: false, error: "Revisa los datos del movimiento.", errors: { amount: ["Ingresa un valor."] } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains a draft that is no longer open, and other failures, without revalidating", async () => {
    mocks.buildCreatePayload.mockResolvedValue({ ok: true, payload: {} });
    setup({ error: { code: "P0002", message: "Borrador no disponible" } });
    expect(await confirmDraft(draftId, {})).toEqual({ ok: false, error: "Este movimiento ya no está por confirmar." });
    setup({ error: { code: "22023", message: "Datos" } });
    expect((await confirmDraft(draftId, {})).ok).toBe(false);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("rejects an invalid id and a missing session", async () => {
    expect(await confirmDraft("x", {})).toEqual({ ok: false, error: "Este movimiento ya no está por confirmar." });
    setup({}, null);
    expect(await confirmDraft(draftId, {})).toEqual({ ok: false, error: "Inicia sesión para guardar el movimiento." });
  });
});

describe("linkDraft", () => {
  it("links without creating a movement", async () => {
    const rpc = setup({});
    expect(await linkDraft(draftId, transactionId)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("link_transaction_draft", { p_draft_id: draftId, p_transaction_id: transactionId });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["23505", "Ese movimiento ya está enlazado a otro correo."],
    ["22023", "Ese movimiento ya no coincide con el correo. Revisa sus datos."],
    ["P0002", "Este movimiento ya no está por confirmar."],
    ["XX000", "No pudimos enlazar el movimiento. Intenta de nuevo."],
  ])("explains error %s", async (code, message) => {
    setup({ error: { code, message: "" } });
    expect(await linkDraft(draftId, transactionId)).toEqual({ ok: false, error: message });
  });

  it("rejects invalid ids and a missing session", async () => {
    expect((await linkDraft(draftId, "x")).ok).toBe(false);
    setup({}, null);
    expect(await linkDraft(draftId, transactionId)).toEqual({ ok: false, error: "Inicia sesión para continuar." });
  });
});

describe("discardDraft", () => {
  it("discards and explains failures", async () => {
    const rpc = setup({});
    expect(await discardDraft(draftId)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("discard_transaction_draft", { p_draft_id: draftId });
    setup({ error: { code: "P0002", message: "" } });
    expect(await discardDraft(draftId)).toEqual({ ok: false, error: "Este movimiento ya no está por confirmar." });
    setup({ error: { code: "XX000", message: "" } });
    expect(await discardDraft(draftId)).toEqual({ ok: false, error: "No pudimos descartar el movimiento. Intenta de nuevo." });
    expect(await discardDraft(1)).toEqual({ ok: false, error: "Este movimiento ya no está por confirmar." });
    setup({}, null);
    expect(await discardDraft(draftId)).toEqual({ ok: false, error: "Inicia sesión para continuar." });
  });
});
