/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SMS_API_BASE?: string;
  readonly VITE_RECEIPT_API_BASE?: string;
  readonly VITE_LAYOUT_API_BASE?: string;
  readonly VITE_BRAND_RUNTIME_BASE?: string;
  readonly VITE_POSTGRES_VIEWER_URL?: string;
  readonly VITE_REDIS_VIEWER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
