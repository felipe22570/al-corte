// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatusActions } from "@/components/subscription-status-actions";

const { refresh, setStatus } = vi.hoisted(() => ({ refresh: vi.fn(), setStatus: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/actions/subscriptions", () => ({ setSubscriptionStatus: setStatus }));

describe("subscription options menu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    setStatus.mockReset().mockResolvedValue({ ok: true });
    refresh.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function open(status: "active" | "paused" = "active") {
    await act(async () => root.render(<SubscriptionStatusActions id="music" status={status} name="Música" />));
    const trigger = container.querySelector<HTMLButtonElement>("button")!;
    expect(trigger.getAttribute("aria-label")).toBe("Más opciones de Música");
    expect(document.querySelector('[role="menu"]')).toBeNull();
    await act(async () => trigger.click());
  }
  function item(text: string) { return [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((node) => node.textContent === text)!; }

  it("hides secondary actions in a menu and styles cancellation as destructive", async () => {
    await open();
    expect(item("Pausar")).toBeDefined();
    expect(item("Cancelar suscripción").className).toContain("text-danger");
    await act(async () => item("Pausar").click());
    expect(setStatus).toHaveBeenCalledExactlyOnceWith("music", "paused");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("offers resume for a paused subscription", async () => {
    await open("paused");
    await act(async () => item("Reanudar").click());
    expect(setStatus).toHaveBeenCalledExactlyOnceWith("music", "active");
  });

  it.each([false, true])("requires cancellation confirmation (confirmed: %s)", async (confirmed) => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(confirmed);
    await open();
    await act(async () => item("Cancelar suscripción").click());
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("¿Cancelar Música?"));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Esto no cancela el servicio con el proveedor."));
    if (confirmed) expect(setStatus).toHaveBeenCalledExactlyOnceWith("music", "cancelled");
    else expect(setStatus).not.toHaveBeenCalled();
  });

  it("shows a failed update and does not refresh", async () => {
    setStatus.mockResolvedValue({ ok: false, error: "No pudimos guardar el cambio." });
    await open();
    await act(async () => item("Pausar").click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("No pudimos guardar el cambio.");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("does not offer status changes for cancelled subscriptions", async () => {
    await act(async () => root.render(<SubscriptionStatusActions id="music" status="cancelled" name="Música" />));
    expect(container.querySelector("button")).toBeNull();
  });
});
