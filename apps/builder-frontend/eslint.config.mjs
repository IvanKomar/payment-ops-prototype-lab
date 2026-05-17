import { createTypeScriptConfig } from "@payment-ops/eslint-config";

export default [
  ...createTypeScriptConfig(),
  {
    files: ["src/**/*.ts", "vite.config.ts"],
    languageOptions: {
      globals: {
        Blob: "readonly",
        DocumentFragment: "readonly",
        Event: "readonly",
        File: "readonly",
        FileReader: "readonly",
        FormData: "readonly",
        HTMLButtonElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLImageElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLPreElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLTextAreaElement: "readonly",
        MouseEvent: "readonly",
        URL: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        document: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        window: "readonly"
      }
    }
  }
];
