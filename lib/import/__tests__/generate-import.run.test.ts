import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { todayInBogota } from "@/lib/domain/dates";
import { buildImportSql, type ImportFile } from "../statement-import";
import { trmByDate } from "../trm";

/**
 * Runner of the step 35 import, not a test: it only runs when the paths are given, so the real file never enters the suite.
 *
 *   AL_CORTE_IMPORT_JSON=docs/al-corte-import-2026-11.json AL_CORTE_IMPORT_TRM=private/trm-datos-gov-co.json \
 *   AL_CORTE_IMPORT_OUT=private/al-corte-import-2026-11.sql AL_CORTE_IMPORT_ADVANCE_FEES=visa=6840 pnpm vitest run lib/import/__tests__/generate-import.run.test.ts
 */
const env = process.env;
describe.skipIf(!env.AL_CORTE_IMPORT_JSON)("statement import script", () => {
  it("writes the SQL script", () => {
    const file = JSON.parse(readFileSync(env.AL_CORTE_IMPORT_JSON!, "utf8")) as ImportFile;
    const trm = trmByDate(JSON.parse(readFileSync(env.AL_CORTE_IMPORT_TRM!, "utf8")));
    const advanceFees = Object.fromEntries((env.AL_CORTE_IMPORT_ADVANCE_FEES ?? "").split(",").filter(Boolean).map((item) => item.split("=") as [string, string]));
    const { sql, warnings } = buildImportSql(file, {
      trm, advanceFees, generatedOn: todayInBogota(),
      trmSource: "TRM oficial de la Superintendencia Financiera, datos abiertos de datos.gov.co (conjunto 32sa-8pi3)",
    });
    writeFileSync(env.AL_CORTE_IMPORT_OUT!, sql);
    if (warnings.length) process.stdout.write(`Diferencias con el banco:\n${warnings.join("\n")}\n`);
    expect(sql).toContain("commit;");
  });
});
