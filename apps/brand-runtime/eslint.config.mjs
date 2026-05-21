import { createTypeScriptConfig } from "@payment-ops/eslint-config";

export default [
  ...createTypeScriptConfig(),
  {
    files: ["src/**/*.{ts,tsx}", "vite.config.ts"],
    languageOptions: {
      globals: {
        HTMLInputElement: "readonly",
        HTMLSelectElement: "readonly",
        URL: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        history: "readonly",
        localStorage: "readonly",
        location: "readonly",
        setTimeout: "readonly",
        window: "readonly"
      }
    }
  }
];
