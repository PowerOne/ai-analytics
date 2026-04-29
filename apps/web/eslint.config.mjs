import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = require("eslint-config-next");

export default [
  {
    ignores: [".next/**", "dist/**"],
  },
  ...next,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": "warn",
      "no-console": "off",

      // Keep lint non-blocking for existing codebase.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
];
