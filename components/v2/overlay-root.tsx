"use client";

import { useSyncExternalStore } from "react";

/** Id of the element inside `[data-ui="v2"]` where dialogs, menus and tips render, so they keep the v2 tokens and fonts. */
export const OVERLAY_ROOT_ID = "ui-overlays";

export function OverlayRoot() {
  return <div id={OVERLAY_ROOT_ID} />;
}

const subscribe = () => () => {};

/** The overlay container once mounted; null on the server, where nothing opens. */
export function useOverlayContainer(): HTMLElement | null {
  return useSyncExternalStore(subscribe, () => document.getElementById(OVERLAY_ROOT_ID), () => null);
}
