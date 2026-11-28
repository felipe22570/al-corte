// Design rules of the new interface (H13): app/v2 and components/v2 use only the v2 tokens through `ui:` classes, never
// v1 components, and never write "/v2" in links (lib/routes.ts owns the base). The current interface must not import v2.
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const V2_DIRS = ["app/v2", "components/v2"];

// Tailwind utilities that must carry the `ui:` prefix inside v2. Bare words that are also common values ("text", "fixed")
// only count with a suffix, so attributes such as type="text" do not trip the rule.
const prefixed = String.raw`(?:bg|text|border|border-[trblxy]|rounded(?:-[trbl]{1,2})?|p[xytrbl]?|m[xytrbl]?|-m[xytrbl]?|gap(?:-[xy])?|w|h|size|min-w|min-h|max-w|max-h|grid-cols|grid-rows|col-span|row-span|items|justify|self|place-items|place-content|content|font|leading|tracking|shadow|ring|outline|opacity|z|top|left|right|bottom|inset(?:-[xy])?|-translate-[xy]|translate-[xy]|overflow(?:-[xy])?|whitespace|basis|grow|shrink|order|divide(?:-[xy])?|space-[xy]|cursor|select|transition|duration|ease|animate|rotate|scale|accent|fill|stroke|decoration|aspect|line-clamp|object|columns|break|wrap)-[\w./[\]%#(),-]+`;
const bare = String.raw`flex|grid|hidden|block|inline|inline-flex|inline-block|contents|sticky|absolute|relative|truncate|underline|uppercase|lowercase|capitalize|tabular-nums|sr-only|grow|shrink|italic`;
const tailwindToken = new RegExp(String.raw`^(?:[\w-]+:|\[[^\]]+\]:)*!?(?:${prefixed}|${bare})$`);
const escape = /design-allow:\s*\S/;

/** Problems of one v2 source file: rule name and line. */
export function lintV2Source(path, source) {
  const problems = [];
  const lines = source.split("\n");
  lines.forEach((line, index) => {
    if (index > 0 && escape.test(lines[index - 1])) return;
    const report = (rule) => problems.push({ path, line: index + 1, rule });
    if (/#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/i.test(line)) report("color literal");
    if (/\p{Extended_Pictographic}/u.test(line)) report("emoji");
    if (/["'`]\/v2(?:[/"'`?#]|$)/.test(line)) report("ruta /v2 escrita a mano: usa v2Routes de lib/routes.ts");
    if (/from\s+["']@\/components\/(?!v2\/)/.test(line) || /from\s+["']@\/app\/(?!v2\/)/.test(line)) report("importa la interfaz actual");
    for (const match of line.matchAll(/from\s+["'](\.{1,2}\/[^"']+)["']/g)) {
      const target = relative(root, resolve(dirname(resolve(root, path)), match[1])).split(sep).join("/");
      if (!V2_DIRS.some((dir) => target === dir || target.startsWith(`${dir}/`)) && (target.startsWith("components/") || target.startsWith("app/"))) report("importa la interfaz actual");
    }
    if (/\bui:(?:[\w-]+:|\[[^\]]+\]:)*(?:bg|text|border|fill|stroke|outline|ring|decoration|accent|from|via|to|shadow)-\[/.test(line)) report("valor arbitrario de color o sombra");
    if (/\bui:(?:[\w-]+:)*shadow\b/.test(line)) report("sombra no permitida");
    const code = /^\s*(?:\/\/|\/?\*)/.test(line) ? "" : line.replace(/\s\/\/\s.*$/, "");
    for (const literal of code.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g)) {
      // Values of other JSX attributes (type="hidden", role="switch") are not classes.
      const attribute = /([\w-]+)=\{?$/.exec(code.slice(0, literal.index))?.[1];
      if (attribute && attribute !== "className") continue;
      const text = (literal[1] ?? literal[2] ?? literal[3] ?? "").replace(/\$\{[^}]*\}/g, " ");
      for (const token of text.split(/\s+/)) {
        if (token && !token.startsWith("ui:") && tailwindToken.test(token)) report(`clase sin prefijo ui: (${token})`);
      }
    }
  });
  return problems;
}

/** Problems of a current-interface file: it must not depend on v2. */
export function lintV1Source(path, source) {
  return source.split("\n").flatMap((line, index) =>
    /from\s+["'](?:@\/components\/v2|@\/app\/v2)\b|["'][^"']*v2\.css["']/.test(line) ? [{ path, line: index + 1, rule: "la interfaz actual importa v2" }] : []);
}

async function files(directory) {
  const result = [];
  for (const entry of await readdir(resolve(root, directory), { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (/\.(tsx|ts|jsx|js|mjs)$/.test(entry.name)) result.push(path.split(sep).join("/"));
  }
  return result;
}

export async function lintProject() {
  const problems = [];
  for (const path of [...await files("app"), ...await files("components")]) {
    if (/__tests__\/|\.test\.tsx?$/.test(path)) continue;
    const source = await readFile(resolve(root, path), "utf8");
    problems.push(...(V2_DIRS.some((dir) => path.startsWith(`${dir}/`)) ? lintV2Source(path, source) : lintV1Source(path, source)));
  }
  return problems;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await lintProject();
  for (const problem of problems) console.error(`${problem.path}:${problem.line}: ${problem.rule}`);
  if (problems.length) process.exitCode = 1;
}
