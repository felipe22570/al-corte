import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lintV1Source, lintV2Source } from "../../scripts/check-design-v2.mjs";

const css = readFileSync("app/v2/v2.css", "utf8");
function tokens(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]+)\\}`))?.[1] ?? "";
  return Object.fromEntries([...block.matchAll(/--v2-([\w-]+):\s*(#[\da-f]{6})\s*;/gi)].map((match) => [match[1]!, match[2]!]));
}
function luminance(hex: string) {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
}
function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe("v2 tokens (docs/design-v2.md)", () => {
  const themes = { dark: tokens('\\[data-ui-theme="dark"\\]'), light: tokens('\\[data-ui-theme="light"\\]') };

  it("keeps the values of docs/design-v2.md in both themes", () => {
    expect(themes.dark).toMatchObject({ ground: "#0d1014", surface: "#151a21", text: "#f3f5f8", primary: "#3dbe8b", "card-1": "#5b9dff" });
    expect(themes.light).toMatchObject({ ground: "#eef1f4", surface: "#ffffff", text: "#121820", primary: "#0f6b4f", "card-1": "#2f6fdb" });
    // The light scrim is the text color at 50 % (rgb with alpha), so it is not a plain hex value.
    expect(Object.keys(themes.dark).filter((key) => key !== "scrim").sort()).toEqual(Object.keys(themes.light).sort());
    expect(css).toContain("--v2-scrim: rgb(18 24 32 / 0.5);");
  });

  it("gives text a contrast of at least 4.5:1 on every surface where it is used, in both themes", () => {
    const pairs: Array<[string, string]> = [
      ...["text", "text-2", "text-3"].flatMap((text) => ["ground", "surface", "surface-raised"].map((background): [string, string] => [text, background])),
      ["text", "track"], ["text-2", "track"],
      ["on-primary", "primary"], ["primary", "primary-soft"], ["primary", "ground"], ["primary", "surface"], ["primary", "surface-raised"],
      ["warning", "warning-soft"], ["danger", "danger-soft"], ["danger", "ground"], ["danger", "surface"], ["ground", "text"],
    ];
    for (const [name, theme] of Object.entries(themes)) {
      for (const [text, background] of pairs) expect(contrast(theme[text]!, theme[background]!), `${name}: ${text} sobre ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("uses Tailwind only with its own prefix and without default scales", () => {
    expect(css).toMatch(/@theme inline prefix\(ui\)\s*\{\s*\/\*[^*]*\*\/\s*--\*: initial;/);
    expect(css).not.toMatch(/@import "tailwindcss";/);
    expect(css).not.toMatch(/@import "tailwindcss\/preflight/);
  });
});

describe("v2 design lint", () => {
  const problems = (source: string, path = "components/v2/example.tsx") => (lintV2Source(path, source) as Array<{ rule: string }>).map((problem) => problem.rule);

  it("accepts v2 classes, tokens and routes", () => {
    expect(problems(`import { v2Routes } from "@/lib/routes";\nimport { cx } from "./cx";\nexport const a = <input type="hidden" role="switch" className="ui:flex ui:bg-surface ui:md:hidden ui:[&_a]:text-danger" href={v2Routes.home} />;`)).toEqual([]);
    expect(problems(`// Comment with \`text-2\` and "flex"\nconst label = "Compra internacional";`)).toEqual([]);
  });

  it("rejects colors, unprefixed classes, v1 imports and hand-written /v2 links", () => {
    expect(problems(`const a = <div className="ui:bg-surface flex text-sm" />;`)).toEqual(["clase sin prefijo ui: (flex)", "clase sin prefijo ui: (text-sm)"]);
    expect(problems(`const a = cx("bg-primary", "ui:p-4");`)).toEqual(["clase sin prefijo ui: (bg-primary)"]);
    expect(problems(`const color = "#3DBE8B";`)).toEqual(["color literal"]);
    expect(problems(`const a = <div className="ui:bg-[red]" />;`)).toEqual(["valor arbitrario de color o sombra"]);
    expect(problems(`const a = <div className="ui:shadow" />;`)).toEqual(["sombra no permitida"]);
    expect(problems(`import { Money } from "@/components/money";`)).toEqual(["importa la interfaz actual"]);
    expect(problems(`import { Money } from "../money";`)).toEqual(["importa la interfaz actual"]);
    expect(problems(`import { Chip } from "../v2/chip";`)).toEqual([]);
    expect(problems(`const href = "/v2/tarjetas";`)).toEqual(["ruta /v2 escrita a mano: usa v2Routes de lib/routes.ts"]);
    expect(problems(`// design-allow: example\nconst color = "#fff";`)).toEqual([]);
  });

  it("keeps the current interface independent from v2", () => {
    expect(lintV1Source("components/money.tsx", `import { Chip } from "@/components/v2/chip";`)).toHaveLength(1);
    expect(lintV1Source("app/layout.tsx", `import "./v2/v2.css";`)).toHaveLength(1);
    expect(lintV1Source("components/money.tsx", `import { formatMoney } from "@/lib/format";`)).toEqual([]);
  });
});
