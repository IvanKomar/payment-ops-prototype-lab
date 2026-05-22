import type { PaymentCoreStatus } from "./payment-core.js";

export type LayoutBuilderFieldStyle = "camelCase" | "snake_case" | "kebab-case";
export type LayoutBuilderPayloadStructure = "flat" | "nested" | "key-value-array";
export type LayoutBuilderIdentityRole = "platform_admin" | "brand_operator" | "merchant_owner";
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

export interface LayoutBuilderContractVersion {
  contractVersionId: string;
  brandId: string;
  schemaId: string;
  slug: string;
  resourceAlias: string;
  payloadStructure: LayoutBuilderPayloadStructure;
  fieldMap: Record<string, string>;
  statusMap: Record<PaymentCoreStatus, string>;
  actionLabels: LayoutBuilderAiGenerationProfile["actionLabels"];
  endpoints: Record<string, string>;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderContractVersionRecord {
  contractVersion: LayoutBuilderContractVersion;
  generatedArtifact: LayoutBuilderGeneratedBrandArtifact | null;
}

export interface LayoutBuilderRegenerateContractRequest {
  aiPrompt?: string;
  systemPrompt?: string;
}

export interface LayoutBuilderBffRequestLog {
  requestLogId: string;
  brandId: string;
  schemaId: string;
  method: "GET" | "POST";
  alias: string;
  publicEndpoint: string;
  operation: string;
  status: "success" | "error";
  requestPayload: unknown;
  responseSummary: unknown;
  errorMessage: string | null;
  durationMs: number;
  createdAt: string;
}

export interface LayoutBuilderAdminIdentity {
  adminId: string;
  email: string;
  displayName: string;
  role: "platform_admin";
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderAdminAuthResponse {
  sessionToken: string;
  admin: LayoutBuilderAdminIdentity;
  expiresAt: string;
}

export interface LayoutBuilderAdminLoginRequest {
  email: string;
  password: string;
}

export interface LayoutBuilderBrandMembership {
  membershipId: string;
  brandId: string;
  subjectType: "admin" | "merchant";
  subjectKey: string;
  role: LayoutBuilderIdentityRole;
  source: "admin_console" | "brand_runtime" | "demo_seed";
  adminId: string | null;
  merchantUserId: string | null;
  merchantEmail: string | null;
  merchantDisplayName: string | null;
  merchantAccountId: string | null;
  createdAt: string;
  updatedAt: string;
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
  contractVersion: LayoutBuilderContractVersion | null;
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
  contractVersion: LayoutBuilderContractVersion | null;
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
