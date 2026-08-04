import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare adapter output. Bundled generated code, tens of thousands of
    // lines; linting it exhausts the heap and reports nothing actionable.
    ".open-next/**",
    ".wrangler/**",
    // Generated from the database schema by `npm run db:types`.
    "src/lib/database.types.ts",
  ]),
]);

export default eslintConfig;
