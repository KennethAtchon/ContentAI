import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

export default [
  js.configs.recommended,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        console: "readonly",
        File: "readonly",
        Blob: "readonly",
        DOMException: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        module: "readonly",
        require: "readonly",
        exports: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        crypto: "readonly",
        Response: "readonly",
        Request: "readonly",
        Headers: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        ReadableStream: "readonly",
        TransformStream: "readonly",
        TextEncoderStream: "readonly",
        RequestInit: "readonly",
        Bun: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Disable base ESLint no-unused-vars in favor of TypeScript version
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
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
      // Guard: never use process.env directly — use envUtil instead
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message:
            "Do not access process.env directly. Use constants from src/utils/config/envUtil instead.",
        },
      ],
      // Guard: never use console — use structured logging
      "no-console": "error",
    },
  },
  // Allowlist: ONLY debug.ts and system-logger.ts can use console
  {
    files: ["src/utils/debug/debug.ts"],
    rules: {
      "no-console": "off",
    },
  },
  {
    files: ["src/utils/system/system-logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
  // Allowlist: envUtil is the one place allowed to read process.env
  {
    files: ["src/utils/config/envUtil.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Allowlist: encryption file can use process.env for encryption keys
  {
    files: ["src/utils/security/encryption.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Allowlist: index.ts can use process.env for server configuration
  {
    files: ["src/index.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  // Allowlist: security middleware can use process.env for security config
  {
    files: ["src/middleware/security-headers.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
  {
    files: ["*.config.ts", "*.config.js", "*.config.mjs"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        __dirname: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
  },
  {
    files: ["scripts/load-test.js"],
    languageOptions: {
      globals: {
        __ENV: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },
  prettier,
  {
    ignores: [
      "dist",
      "node_modules",
      "src/infrastructure/database/lib/generated",
    ],
  },
];
