// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureSettings } from "@/components/capture-settings";

const mocks = vi.hoisted(() => ({ setCaptureEnabled: vi.fn(), addCardAlias: vi.fn(), removeCardAlias: vi.fn() }));
vi.mock("@/lib/actions/capture", () => mocks);

const visa = { id: "11111111-1111-4111-8111-111111111111", name: "Visa", last4: "1999", color: "card-1" as const };

function setInput(element: HTMLInputElement, value: string) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("CaptureSettings", () => {
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
  const render = (enabled: boolean, aliases: Array<{ id: string; cardId: string; last4: string }> = []) => act(async () => root.render(<CaptureSettings enabled={enabled} cards={[visa]} aliases={aliases} />));
  const button = (text: string) => [...container.querySelectorAll<HTMLButtonElement>("button")].find((element) => element.textContent?.startsWith(text))!;

  it("turns capture on and explains what it does", async () => {
    mocks.setCaptureEnabled.mockResolvedValue({ ok: true });
    await render(false);
    expect(container.textContent).toContain("Apagada. Las alertas que lleguen mientras tanto no se guardan.");
    await act(async () => container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    expect(mocks.setCaptureEnabled).toHaveBeenCalledWith(true);
    await render(true);
    expect(container.textContent).toContain("No cuentan en tus meses hasta que los confirmes.");
  });

  it("adds only 4 digits and clears the field", async () => {
    mocks.addCardAlias.mockResolvedValue({ ok: true });
    await render(true);
    const input = container.querySelector<HTMLInputElement>("#alias-last4")!;
    await act(async () => setInput(input, "43a21x"));
    expect(input.value).toBe("4321");
    await act(async () => button("Agregar").click());
    expect(mocks.addCardAlias).toHaveBeenCalledWith({ cardId: visa.id, last4: "4321" });
    expect(input.value).toBe("");
  });

  it("lists and removes aliases, showing errors", async () => {
    mocks.removeCardAlias.mockResolvedValueOnce({ ok: false, error: "No pudimos quitar los dígitos. Intenta de nuevo." }).mockRejectedValueOnce(new Error("offline"));
    await render(true, [{ id: "a1", cardId: visa.id, last4: "4321" }]);
    expect(container.textContent).toContain("Visa · •••• 4321");
    await act(async () => button("Quitar").click());
    expect(mocks.removeCardAlias).toHaveBeenCalledWith("a1");
    expect(container.textContent).toContain("No pudimos quitar los dígitos. Intenta de nuevo.");
    await act(async () => button("Quitar").click());
    expect(container.textContent).toContain("No pudimos guardar el cambio. Intenta de nuevo.");
  });
});
