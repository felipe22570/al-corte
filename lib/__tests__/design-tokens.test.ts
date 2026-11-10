import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { alCorteThemeColors } from "@/lib/brand";

const css = readFileSync("app/globals.css", "utf8");
function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map((match) => [match[1]!, match[2]!]));
}
function luminance(hex: string) {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}
it("sincroniza los colores de marca y asegura contraste de los campos", () => {
  const light = tokens(":root");
  const dark = tokens("\\.dark");
  expect(light.surface).toBe(alCorteThemeColors.light);
  expect(dark.surface).toBe(alCorteThemeColors.dark);
  expect(contrast(light.input!, light["surface-raised"]!)).toBeGreaterThanOrEqual(3);
  expect(contrast(dark.input!, dark["surface-raised"]!)).toBeGreaterThanOrEqual(3);
});
it("cumple los contrastes de texto y tarjetas en ambos temas", () => {
  const pairs: Array<[string, string, number]> = [
    ["ink", "surface", 4.5], ["ink", "surface-raised", 4.5],
    ["ink-muted", "surface", 4.5], ["ink-muted", "surface-raised", 4.5],
    ["primary-foreground", "primary", 4.5], ["primary", "primary-soft", 4.5],
    ["warning", "warning-soft", 4.5], ["danger", "danger-soft", 4.5],
    ["danger", "surface-raised", 4.5],
    ...[1, 2, 3, 4, 5, 6].map((i): [string, string, number] => [`card-${i}`, "surface-raised", 3]),
  ];
  const light = tokens(":root");
  const dark = tokens("\\.dark");
  expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  for (const [foreground, background, minimum] of pairs) {
    expect(contrast(light[foreground]!, light[background]!), `claro ${foreground}/${background}`).toBeGreaterThanOrEqual(minimum);
    expect(contrast(dark[foreground]!, dark[background]!), `oscuro ${foreground}/${background}`).toBeGreaterThanOrEqual(minimum);
  }
});
