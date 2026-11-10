export const APP_NAME = "Al Corte";
export const APP_TAGLINE = "Tus tarjetas, claras antes de cada corte.";
export const STORAGE_PREFIX = "al-corte:";

// Deben coincidir con --surface en app/globals.css.
export const alCorteThemeColors = { light: "#f7f5f0", dark: "#0f1412" } as const;

export function storageKey(name: string): string {
  return `${STORAGE_PREFIX}${name}`;
}
