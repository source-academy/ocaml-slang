import eslintConfigPrettierFlat from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig([
  { ignores: ["dist", "coverage", "node_modules", "_build", "_opam"] },
  tseslint.configs.recommended,
  eslintConfigPrettierFlat,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ["./tsconfig.json", "./tsconfig.test.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/return-await": ["error", "in-try-catch"],
      "@typescript-eslint/no-import-type-side-effects": "error",
    },
  },
]);
