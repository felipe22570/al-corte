import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Step 44: Apps Script files share one global scope and the trigger calls functions by name.
    files: ["integrations/apps-script/src/**/*.js"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^(AlCorteCapture|capturePurchaseAlerts|installTrigger)$" }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
