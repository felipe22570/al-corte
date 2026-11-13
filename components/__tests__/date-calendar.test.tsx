// @vitest-environment jsdom

import { act, StrictMode, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DateCalendar } from "@/components/date-calendar";
import { DateInput } from "@/components/date-input";
import { Sheet } from "@/components/ui/sheet";

function CalendarField({ initialValue, inSheet }: { initialValue: string; inSheet: boolean }) {
  const [value, setValue] = useState(initialValue);
  const [open, setOpen] = useState(true);
  const field = <DateInput id="date" value={value} onValueChange={setValue} calendarLabel="Fecha de prueba" />;
  return inSheet
    ? <Sheet title="Formulario" open={open} onOpenChange={setOpen} trigger={<button>Abrir formulario</button>}>{field}</Sheet>
    : field;
}

async function settleFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
}

describe("calendar keyboard focus", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it.each([
    ["2026-11-12", "PageDown", "2026-12-12"],
    ["2026-11-12", "PageUp", "2026-10-12"],
    ["2026-11-30", "ArrowRight", "2026-12-01"],
    ["2026-12-01", "ArrowLeft", "2026-11-30"],
    ["2026-11-28", "ArrowDown", "2026-12-05"],
    ["2026-12-05", "ArrowUp", "2026-11-28"],
    ["2026-12-31", "ArrowRight", "2027-01-01"],
    ["2028-01-31", "PageDown", "2028-02-29"],
    ["2026-11-12", "ArrowRight", "2026-11-13"],
    ["2026-11-12", "Home", "2026-11-01"],
    ["2026-11-12", "End", "2026-11-30"],
  ])("focuses %s + %s on %s before the next frame", (value, key, expected) => {
    const onSelect = vi.fn();
    act(() => root.render(<StrictMode><DateCalendar label="Fecha" value={value} onSelect={onSelect} /></StrictMode>));
    const initial = container.querySelector<HTMLButtonElement>(`[data-date="${value}"]`)!;
    initial.focus();

    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    act(() => { initial.dispatchEvent(event); });

    const target = container.querySelector<HTMLButtonElement>(`[data-date="${expected}"]`)!;
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(target);
    expect(target.tabIndex).toBe(0);
    expect(container.querySelectorAll('[data-date][tabindex="0"]')).toHaveLength(1);
    expect(onSelect).not.toHaveBeenCalled();
    // Activate the focused button; native Enter activation is checked in Chromium.
    act(() => { (document.activeElement as HTMLButtonElement).click(); });
    expect(onSelect).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it("does not steal focus on mount or when the month buttons are used", () => {
    const outside = document.createElement("button");
    container.before(outside);
    outside.focus();
    act(() => root.render(<DateCalendar label="Fecha" value="2026-11-12" onSelect={() => {}} />));
    expect(document.activeElement).toBe(outside);

    const next = container.querySelector<HTMLButtonElement>('[aria-label="Mes siguiente"]')!;
    next.focus();
    act(() => next.click());
    expect(document.activeElement).toBe(next);
    expect(container.querySelector('[data-date="2026-12-12"]')?.getAttribute("tabindex")).toBe("0");
    outside.remove();
  });

  describe.each([false, true])("inside a popover (sheet: %s)", (inSheet) => {
    it.each([
      ["2026-11-12", "PageDown", "2026-12-12", "12/12/2026"],
      ["2026-11-30", "ArrowRight", "2026-12-01", "01/12/2026"],
      ["2026-12-01", "ArrowLeft", "2026-11-30", "30/11/2026"],
    ])("keeps %s + %s focused on %s after focus recovery", async (initialValue, key, expected, display) => {
      await act(async () => root.render(<CalendarField initialValue={initialValue} inSheet={inSheet} />));
      const trigger = document.querySelector<HTMLButtonElement>('[aria-label="Abrir calendario: Fecha de prueba"]')!;
      await act(async () => trigger.click());
      await settleFrames();
      expect(document.activeElement?.getAttribute("data-date")).toBe(initialValue);

      await act(async () => {
        document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
      });
      await settleFrames();
      expect(document.activeElement?.getAttribute("data-date")).toBe(expected);

      await act(async () => { (document.activeElement as HTMLButtonElement).click(); });
      await settleFrames();
      expect(document.querySelector<HTMLInputElement>("#date")?.value).toBe(display);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      if (inSheet) expect(document.querySelector("#date")?.closest('[role="dialog"]')).not.toBeNull();
    });
  });
});
