import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  js.configs.recommended,
  {
    files: [
      "src/**/*.ts",
      "src/**/*.tsx",
      "*.config.ts",
      "*.config.js",
      "*.config.mjs",
    ],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        performance: "readonly",
        MutationObserver: "readonly",
        File: "readonly",
        FileReader: "readonly",
        HTMLInputElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLDivElement: "readonly",
        HTMLVideoElement: "readonly",
        IntersectionObserver: "readonly",
        IntersectionObserverEntry: "readonly",
        KeyboardEvent: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        BodyInit: "readonly",
        global: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        crypto: "readonly",
        sessionStorage: "readonly",
        config: "readonly",
        RequestInit: "readonly",
        Response: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        fetch: "readonly",
        React: "readonly",
        localStorage: "readonly",
        require: "readonly",
        process: "readonly",
        Blob: "readonly",
        NodeJS: "readonly",
        alert: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
    },
    rules: {
      // Disable base ESLint no-unused-vars in favor of TypeScript version
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-useless-escape": "off",
      "no-control-regex": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Guard: never use import.meta.env directly — use envUtil instead
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='import'][object.property.name='meta'][property.name='env']",
          message:
            "Do not access import.meta.env directly. Use constants from @/shared/utils/config/envUtil instead.",
        },
      ],
      // Guard: never use raw fetch — use useQueryFetcher or useAuthenticatedFetch
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Do not use raw fetch. Use useQueryFetcher (GET/cache) or useAuthenticatedFetch (mutations) instead.",
        },
      ],
      // Guard: never use console — use debugLog from @/shared/utils/debug
      "no-console": "error",
    },
  },
  // Allowlist: ONLY debug.ts and system-logger.ts can use console
  {
    files: ["src/shared/utils/debug/debug.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["src/shared/utils/system/system-logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Allowlist: envUtil is the one place allowed to read import.meta.env
  {
    files: ["src/shared/utils/config/envUtil.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Allowlist: safe-fetch is the one place allowed to call raw fetch
  {
    files: ["src/shared/services/api/safe-fetch.ts"],
    rules: {
      "no-restricted-globals": "off",
    },
  },
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-var-requires": "off",
    },
  },
  prettier,
  {
    ignores: [
      "dist",
      "node_modules",
      "src/routeTree.gen.ts",
      "src/shared/components/ui",
    ],
  },
];
