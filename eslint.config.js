import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Nested build outputs (e.g. demo/dist) are ignored too — "dist/" alone
    // only matches the top level.
    ignores: ["**/dist/", "**/node_modules/", "package-lock.json"],
  },
  {
    // Plain Node scripts (server.mjs) use Node/builtin globals directly.
    files: ["**/server.mjs"],
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
      },
    },
  },
);
