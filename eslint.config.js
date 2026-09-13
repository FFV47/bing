import js from "@eslint/js";
import globals from "globals";
import json from "@eslint/json";
import tseslint from "typescript-eslint";

import { defineConfig } from "eslint/config";

export default defineConfig(
  {
    files: ["**/*.{js,mjs,cjs}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-misused-promises": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
  {
    files: ["**/*.json"],
    language: "json/json",
    ...json.configs.recommended,
  },
  {
    ignores: ["chrome-user-data/**"],
  }
);
