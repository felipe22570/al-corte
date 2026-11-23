// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DraftActions } from "@/components/draft-actions";

const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), linkDraft: vi.fn(), discardDraft: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }));
vi.mock("@/lib/actions/drafts", () => ({ linkDraft: mocks.linkDraft, discardDraft: mocks.discardDraft }));

describe("DraftActions", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent?.startsWith(text))!;
  async function render() {
    await act(async () => root.render(<DraftActions draftId="d1" name="DIRECTV" candidates={[{ id: "t1", label: "DirecTV · 17 nov · $140.910" }]} />));
  }

  it("links the same movement and returns to the inbox", async () => {
    mocks.linkDraft.mockResolvedValue({ ok: true });
    await render();
    await act(async () => button("Es el mismo").click());
    expect(mocks.linkDraft).toHaveBeenCalledWith("d1", "t1");
    expect(mocks.replace).toHaveBeenCalledWith("/por-confirmar?notice=linked");
  });

  it("asks before discarding and does nothing if the owner cancels", async () => {
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    vi.stubGlobal("confirm", confirm);
    mocks.discardDraft.mockResolvedValue({ ok: true });
    await render();
    await act(async () => button("Descartar").click());
    expect(mocks.discardDraft).not.toHaveBeenCalled();
    await act(async () => button("Descartar").click());
    expect(confirm.mock.calls[1]![0]).toContain("No volverá a aparecer aunque el correo llegue otra vez.");
    expect(mocks.discardDraft).toHaveBeenCalledWith("d1");
    expect(mocks.replace).toHaveBeenCalledWith("/por-confirmar?notice=discarded");
  });

  it("shows errors from the server and from the network", async () => {
    mocks.linkDraft.mockResolvedValueOnce({ ok: false, error: "Ese movimiento ya está enlazado a otro correo." }).mockRejectedValueOnce(new Error("offline"));
    await render();
    await act(async () => button("Es el mismo").click());
    expect(container.textContent).toContain("Ese movimiento ya está enlazado a otro correo.");
    await act(async () => button("Es el mismo").click());
    expect(container.textContent).toContain("No pudimos completar la acción. Intenta de nuevo.");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("confirms in the prefilled form", async () => {
    await render();
    expect(container.querySelector("a")!.getAttribute("href")).toBe("/movimientos/nuevo?borrador=d1");
  });
});
