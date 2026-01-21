import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**", "convex/_generated/**"],
  },
  js.configs.recommended,
  tseslint.configs.base,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      "no-case-declarations": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
    },
  },
  reactHooks.configs.flat.recommended,
  next.configs["core-web-vitals"],
  {
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/set-state-in-effect": "off",
    },
  },
];
