import type { PaymentCoreStatus } from "./payment-core.js";

export type LayoutBuilderFieldStyle = "camelCase" | "snake_case" | "kebab-case";
export type LayoutBuilderPayloadStructure = "flat" | "nested" | "key-value-array";
export type LayoutBuilderLayoutVariant =
  | "classic"
  | "summary-left"
  | "dense-ops"
  | "command-center"
  | "finance-ledger"
  | "compact-review";

export interface LayoutBuilderAiGenerationProfile {
  provider: "local" | "openai" | "gemini" | "anthropic" | "codex";
  model: string;
  adminPrompt: string;
  systemPrompt: string;
  resourceAlias: string;
  visualDirection: string;
  contractSummary: string;
  statusMap: Record<PaymentCoreStatus, string>;
  actionLabels: {
    register: string;
    login: string;
    createPayment: string;
    history: string;
    refund: string;
  };
  generatedAt: string;
}

export type LayoutBuilderGeneratedBrandCapability =
  | "register_user"
  | "login_user"
  | "read_payments"
  | "create_payment"
  | "read_customers"
  | "create_customer"
  | "read_balance_transactions";

export interface LayoutBuilderGeneratedBrandArtifact {
  artifactId: string;
  brandId: string;
  provider: LayoutBuilderAiGenerationProfile["provider"];
  model: string;
  framework: "react-vite";
  entryFile: string;
  contractVersionId: string;
  facadeBasePath: string;
  routes: Array<{
    path: string;
    label: string;
    requiresSession: boolean;
  }>;
  capabilities: LayoutBuilderGeneratedBrandCapability[];
  files: Array<{
    path: string;
    kind: "entry" | "component" | "style" | "contract";
    bytes: number;
    content: string;
  }>;
  validation: {
    status: "passed";
    checks: string[];
  };
  generatedAt: string;
}

export interface LayoutBuilderPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface LayoutBuilderPaymentRow {
  transactionId: string;
  status: "created" | "pending" | "paid" | "failed" | "refunded";
  requestedAmount: number;
  paidAmount: number;
  createdAt: string;
  paidAt: string | null;
}

export interface LayoutBuilderDashboardConfig {
  title: string;
  balance: number;
  currency: string;
  pageSize: number;
  payments: LayoutBuilderPaymentRow[];
}

export interface LayoutBuilderSchemaField {
  canonical: string;
  external: string;
}

export interface LayoutBuilderBrandSchemaResponse {
  brandId: string;
  schemaId: string;
  name: string;
  logoMimeType: string;
  palette: LayoutBuilderPalette;
  endpoint: string;
  dataEndpoint: string;
  appUrl: string;
  generatedPreviewUrl: string | null;
  method: "POST";
  methods: Array<"GET" | "POST">;
  fieldsStyle: LayoutBuilderFieldStyle;
  structure: LayoutBuilderPayloadStructure;
  layoutVariant: LayoutBuilderLayoutVariant;
  fields: Record<string, string>;
  generationProfile: LayoutBuilderAiGenerationProfile | null;
  generatedArtifact: LayoutBuilderGeneratedBrandArtifact | null;
  samplePayload: unknown;
}

export interface LayoutBuilderBrandResponse extends LayoutBuilderBrandSchemaResponse {
  name: string;
  logoMimeType: string;
  palette: LayoutBuilderPalette;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderBrandListItem {
  brandId: string;
  name: string;
  logoMimeType: string;
  palette: LayoutBuilderPalette;
  dataEndpoint: string;
  appUrl: string;
  generatedPreviewUrl: string | null;
  generationProfile: LayoutBuilderAiGenerationProfile | null;
  generatedArtifact: LayoutBuilderGeneratedBrandArtifact | null;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderConfigureResponse {
  requestId: string;
  brandId: string;
  layoutUrl: string;
  data: unknown;
}

export interface LayoutBuilderDeleteBrandResponse {
  brandId: string;
  deleted: true;
}
