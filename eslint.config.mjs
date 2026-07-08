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
    // Prisma 產生的 client（gitignored，不該被 lint）
    "src/generated/**",
    // 一次性維護腳本（非應用程式碼，容忍度較高）
    "scripts/**",
  ]),
]);

export default eslintConfig;
