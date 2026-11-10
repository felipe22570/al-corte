import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const rules = [
  ["color literal", /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|oklch)\(/i],
  ["color de paleta", /\b(?:bg|text|border|ring|fill|stroke|from|to|via|outline|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-\d+)?\b/],
  ["radio fuera de escala", /\brounded-(?:lg|[234]xl|\[)/],
  ["tamaño de texto fuera de escala", /\btext-(?:(?:xs|sm|base|lg|(?:[1-9])?xl)(?![\w-])|\[)/],
  ["emoji", /\p{Extended_Pictographic}/u],
];
const shadowAllowed = /^components\/ui\/(sheet|dialog|dropdown-menu|popover|select|sonner)\.tsx$/;
let errors = 0;

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(tsx|ts|jsx|js)$/.test(path)) {
      const lines = (await readFile(path, "utf8")).split("\n");
      lines.forEach((line, index) => {
        if (index > 0 && /design-allow:\s*\S/.test(lines[index - 1])) return;
        const checks = shadowAllowed.test(path) ? rules : [...rules, ["sombra no permitida", /\bshadow-(?!none\b)[\w-]+/]];
        for (const [name, pattern] of checks) if (pattern.test(line)) {
          console.error(`${path}:${index + 1}: ${name}`);
          errors++;
        }
      });
    }
  }
}
await scan("app");
await scan("components");
if (errors) process.exitCode = 1;
