const globals = require("globals")
const next = require("@next/eslint-plugin-next")
const react = require("eslint-plugin-react")
const reactHooks = require("eslint-plugin-react-hooks")
const tseslint = require("typescript-eslint")

module.exports = tseslint.config(
  {
    ignores: [
      ".next/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "node_modules/**",
      ".replit_integration_files/**",
      "public/pdf.worker.min.mjs",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@next/next": next,
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: { version: "detect" },
    },
    rules: {
      // React 19 no longer requires React in JSX scope. Keep the hook rules
      // enabled as warnings while the existing app is incrementally cleaned up.
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
)
