/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SMS_API_BASE?: string;
  readonly VITE_RECEIPT_API_BASE?: string;
  readonly VITE_LAYOUT_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
