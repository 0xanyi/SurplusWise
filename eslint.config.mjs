import js from "@eslint/js";
import next from "@next/eslint-plugin-next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [".next/**", "node_modules/**"],
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
  {
    // Client calls to our own API must carry `x-workspace-id`, which only
    // `apiFetch` adds. Without it `requireAuthWithWorkspace()` silently falls
    // back to the user's default workspace, so the request reads or writes the
    // wrong workspace while the UI shows another one. A bare `fetch` is only
    // correct for endpoints that are genuinely workspace-agnostic; those need
    // an eslint-disable line saying why.
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "contexts/**/*.{ts,tsx}"],
    ignores: ["app/api/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'CallExpression[callee.name="fetch"][arguments.0.value=/^\\/api\\//]',
          message:
            "Use apiFetch from @/hooks/use-api so the request carries x-workspace-id. If the endpoint is workspace-agnostic, disable this rule on the line and say why.",
        },
        {
          selector:
            'CallExpression[callee.name="fetch"][arguments.0.quasis.0.value.raw=/^\\/api\\//]',
          message:
            "Use apiFetch from @/hooks/use-api so the request carries x-workspace-id. If the endpoint is workspace-agnostic, disable this rule on the line and say why.",
        },
      ],
    },
  },
];
