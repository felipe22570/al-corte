"use client";

import { Popover } from "@base-ui/react/popover";
import type { ReactNode } from "react";
import { useOverlayContainer } from "./overlay-root";

/**
 * Help on demand (docs/design-v2.md, rule 5): calculation notes open from an "i" button instead of staying on screen.
 * Opens on click or tap, so it works on a phone; Escape closes it.
 */
export function InfoTip({ children, label = "Qué es esto" }: { children: ReactNode; label?: string }) {
  const container = useOverlayContainer();
  return <Popover.Root>
    <Popover.Trigger aria-label={label} className="ui:inline-flex ui:size-5 ui:shrink-0 ui:cursor-pointer ui:items-center ui:justify-center ui:rounded-full ui:border ui:border-strong-border ui:bg-transparent ui:p-0 ui:align-middle ui:text-tag ui:font-semibold ui:text-text-2 ui:data-popup-open:border-primary ui:data-popup-open:bg-primary-soft ui:data-popup-open:text-primary ui:pointer-coarse:size-7">i</Popover.Trigger>
    <Popover.Portal container={container}>
      <Popover.Positioner sideOffset={6} align="start" className="ui:z-50">
        <Popover.Popup className="ui:max-w-tip ui:rounded-control ui:bg-track ui:px-3 ui:py-2.5 ui:text-support ui:text-text ui:outline-none">{children}</Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>;
}
