import type { PaymentCoreStatus } from "./payment-core.js";

export type LayoutBuilderFieldStyle = "camelCase" | "snake_case" | "kebab-case";
export type LayoutBuilderPayloadStructure = "flat" | "nested" | "key-value-array";
export type LayoutBuilderIdentityRole = "platform_admin" | "brand_operator" | "merchant_owner";
export type LayoutBuilderAiProvider = "local" | "openai" | "gemini" | "anthropic" | "codex";
export type LayoutBuilderAiCredentialMode = "none" | "server_api_key";
export type LayoutBuilderBrandDraftStatus = "draft" | "valid" | "invalid" | "created";
export type LayoutBuilderClarificationQuestionType = "text" | "single_select" | "multi_select";
export type LayoutBuilderClarificationAnswerValue = string | string[];
export type LayoutBuilderClarificationAnswers = Record<string, LayoutBuilderClarificationAnswerValue>;
export type LayoutBuilderAiFieldStyle = LayoutBuilderFieldStyle;
export type LayoutBuilderAiEnvelopeStyle = "plain" | "resource_key" | "data" | "result";
export type LayoutBuilderAiNamingIntensity = "moderate" | "high" | "maximum";
export type LayoutBuilderAiUiLayout =
  | "sidebar-ledger"
  | "topbar-console"
  | "split-workspace"
  | "command-center"
  | "card-operations"
  | "compact-terminal";
export type LayoutBuilderAiUiDensity = "compact" | "balanced" | "spacious";
export type LayoutBuilderAiUiNavigationPattern = "sidebar" | "top-tabs" | "command-rail";
export type LayoutBuilderAiDashboardBlock = "metrics" | "recentPayments" | "balances" | "customers" | "createPayment";
export type LayoutBuilderBrandIntentSource = "external-chat" | "codex" | "gemini" | "claude" | "manual";
export type LayoutBuilderLayoutVariant =
  | "classic"
  | "summary-left"
  | "dense-ops"
  | "command-center"
  | "finance-ledger"
  | "compact-review";

export interface LayoutBuilderClarificationQuestion {
  id: string;
  label: string;
  type: LayoutBuilderClarificationQuestionType;
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface LayoutBuilderClarifyBrandRequest {
  brandName: string;
  aiPrompt: string;
  aiProvider?: LayoutBuilderAiProvider;
  aiModel?: string;
}

export interface LayoutBuilderClarifyBrandResponse {
  aiProvider: LayoutBuilderAiProvider;
  aiModel: string;
  credentialMode: LayoutBuilderAiCredentialMode;
  questions: LayoutBuilderClarificationQuestion[];
  readyToGenerate: boolean;
}

export interface LayoutBuilderAiGenerationControls {
  payloadStructure: LayoutBuilderPayloadStructure;
  fieldStyle: LayoutBuilderAiFieldStyle;
  authShape: "credentials" | "access_key" | "workspace";
  responseEnvelope: LayoutBuilderAiEnvelopeStyle;
  routeNaming: "product" | "finance" | "abstract";
  errorStyle: "standard" | "branded";
  namingIntensity: LayoutBuilderAiNamingIntensity;
}

export interface LayoutBuilderAiEntitySpec {
  route: string;
  method: "GET" | "POST";
  requiresSession: boolean;
  requestKey: string;
  responseKey: string;
  emptyState: string;
}

export interface LayoutBuilderAiAuthSpec {
  tokenResponseKey: string;
  tokenStorageKey: string;
  errorKey: string;
  fields: {
    email: string;
    password: string;
    displayName: string;
    currency: string;
  };
}

export interface LayoutBuilderAiUiPresentationSpec {
  layout: LayoutBuilderAiUiLayout;
  density: LayoutBuilderAiUiDensity;
  navigationPattern: LayoutBuilderAiUiNavigationPattern;
  dashboardComposition: LayoutBuilderAiDashboardBlock[];
  visualTokens: {
    palette: string[];
    typography: string;
    radius: string;
    spacing: string;
    surfaces: string;
    buttons: string;
  };
  copyTone: string;
  componentLabels: Record<string, string>;
  emptyStates: Record<string, string>;
}

export interface LayoutBuilderAiBrandSpec {
  brand: {
    displayName: string;
    visualDirection: string;
    contractSummary: string;
    paletteHints: string[];
  };
  controls: LayoutBuilderAiGenerationControls;
  resourceAlias: string;
  entities: {
    register: LayoutBuilderAiEntitySpec;
    login: LayoutBuilderAiEntitySpec;
    account: LayoutBuilderAiEntitySpec;
    metrics: LayoutBuilderAiEntitySpec;
    payments: LayoutBuilderAiEntitySpec;
    customers: LayoutBuilderAiEntitySpec;
    paymentMethods: LayoutBuilderAiEntitySpec;
    balances: LayoutBuilderAiEntitySpec;
  };
  fields: {
    payment: Record<string, string>;
    customer: Record<string, string>;
    paymentMethod: Record<string, string>;
    balance: Record<string, string>;
    account: Record<string, string>;
    user: Record<string, string>;
    metrics: Record<string, string>;
  };
  auth: LayoutBuilderAiAuthSpec;
  statuses: Record<PaymentCoreStatus, string>;
  ui: {
    labels: {
      register: string;
      login: string;
      createPayment: string;
      history: string;
      refund: string;
      overview: string;
      payments: string;
      customers: string;
      balances: string;
    };
    navigation: Record<"dashboard" | "payments" | "customers" | "balances", string>;
    tableLabels: Record<string, string>;
    formLabels: Record<string, string>;
    presentation: LayoutBuilderAiUiPresentationSpec;
  };
}

export interface LayoutBuilderBrandGenerationIntent {
  brandName: string;
  concept: {
    domain: string;
    audience: string;
    productMetaphor: string;
    authMetaphor: string;
    paymentMetaphor: string;
    tone: string;
    avoidWords: string[];
    preferredTerms: string[];
  };
  namingRules: {
    routeStyle: string;
    fieldStyle?: LayoutBuilderFieldStyle | undefined;
    forbiddenCanonicalNames: string[];
    examples: string[];
  };
  uiDirection: {
    layout: string;
    density: string;
    navigation: string;
    visualStyle: string;
    palette: string[];
    dashboardBlocks: string[];
  };
  copy: {
    loginTitle: string;
    registerTitle: string;
    emptyStates: Record<string, string>;
    actionLabels: Record<string, string>;
  };
  statusVocabulary?: Partial<Record<PaymentCoreStatus, string | undefined>> | undefined;
}

export interface LayoutBuilderBrandGenerationMessage {
  role: "admin" | "assistant";
  content: string;
  createdAt: string;
}

export interface LayoutBuilderBrandGenerationDraft {
  draftId: string;
  brandName: string;
  adminPrompt: string;
  systemPrompt: string;
  provider: LayoutBuilderAiProvider;
  model: string;
  controls: LayoutBuilderAiGenerationControls;
  messages: LayoutBuilderBrandGenerationMessage[];
  spec: LayoutBuilderAiBrandSpec | null;
  validationIssues: string[];
  status: LayoutBuilderBrandDraftStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderCreateBrandDraftRequest {
  brandName: string;
  adminPrompt: string;
  systemPrompt?: string;
  provider?: LayoutBuilderAiProvider;
  model?: string;
  controls?: Partial<LayoutBuilderAiGenerationControls>;
}

export interface LayoutBuilderCreateBrandDraftFromSpecRequest {
  brandName: string;
  adminPrompt?: string;
  systemPrompt?: string;
  provider?: LayoutBuilderAiProvider;
  model?: string;
  controls?: Partial<LayoutBuilderAiGenerationControls>;
  spec: unknown;
}

export interface LayoutBuilderCreateBrandIntentDraftRequest {
  intent: LayoutBuilderBrandGenerationIntent;
  adminPrompt?: string;
  source?: LayoutBuilderBrandIntentSource;
  model?: string;
  controls?: Partial<LayoutBuilderAiGenerationControls>;
}

export interface LayoutBuilderAppendBrandDraftMessageRequest {
  message: string;
  controls?: Partial<LayoutBuilderAiGenerationControls>;
}

export interface LayoutBuilderBrandSpecUniquenessResult {
  score: number;
  threshold: number;
  issues: string[];
}

export interface LayoutBuilderBrandRuntimeDictionary {
  visibility: "bff_private";
  source: "intent_compiler" | "managed_ai_spec" | "external_ai_spec" | "generated_profile";
  controls: LayoutBuilderAiGenerationControls;
  forbiddenPublicTerms: string[];
  publicRoutes: Record<
    "register" | "login" | "account" | "metrics" | "payments" | "customers" | "paymentMethods" | "balances",
    string
  >;
  requestKeys: Record<string, string>;
  responseKeys: Record<string, string>;
  fieldAliases: Record<string, string>;
  statusAliases: Record<PaymentCoreStatus, string>;
  actionLabels: Record<string, string>;
  visualTokens: LayoutBuilderAiUiPresentationSpec["visualTokens"] & {
    layout: LayoutBuilderAiUiLayout;
    density: LayoutBuilderAiUiDensity;
    navigationPattern: LayoutBuilderAiUiNavigationPattern;
    dashboardComposition: LayoutBuilderAiDashboardBlock[];
  };
}

export interface LayoutBuilderAiGenerationProfile {
  provider: LayoutBuilderAiProvider;
  credentialMode?: LayoutBuilderAiCredentialMode;
  model: string;
  adminPrompt: string;
  systemPrompt: string;
  clarificationAnswers?: LayoutBuilderClarificationAnswers;
  generatedSummary?: string;
  resourceAlias: string;
  visualDirection: string;
  contractSummary: string;
  dictionary?: LayoutBuilderBrandRuntimeDictionary;
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
  sourceType: "ai-intent" | "ai-spec" | "external-spec" | "generated-react";
  status: "draft" | "active" | "archived";
  framework: "react-vite";
  entryFile: string;
  contractVersionId: string;
  facadeBasePath: string;
  uiSpec: LayoutBuilderAiBrandSpec["ui"];
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

export interface LayoutBuilderAgentManifestEndpoint {
  method: "GET" | "POST";
  path: string;
  authRequired: boolean;
  contentType: "application/json" | "multipart/form-data";
  purpose: string;
}

export interface LayoutBuilderAgentManifest {
  manifestVersion: string;
  purpose: string;
  flows: Array<"managed_draft" | "external_spec_import" | "direct_create_from_spec">;
  endpoints: LayoutBuilderAgentManifestEndpoint[];
  schemas: {
    aiBrandSpec: unknown;
    createBrandDraftRequest: unknown;
    createBrandDraftFromSpecRequest: unknown;
  };
  allowedEnums: {
    providers: LayoutBuilderAiProvider[];
    payloadStructures: LayoutBuilderPayloadStructure[];
    fieldStyles: LayoutBuilderFieldStyle[];
    responseEnvelopes: LayoutBuilderAiEnvelopeStyle[];
    namingIntensities: LayoutBuilderAiNamingIntensity[];
    uiLayouts: LayoutBuilderAiUiLayout[];
    uiDensities: LayoutBuilderAiUiDensity[];
    navigationPatterns: LayoutBuilderAiUiNavigationPattern[];
    dashboardBlocks: LayoutBuilderAiDashboardBlock[];
    paymentStatuses: PaymentCoreStatus[];
  };
  reservedRouteSlugs: string[];
  validationRules: {
    routeSlugPattern: string;
    aliasPattern: string;
    requiredEntities: string[];
    uniquenessThreshold: number;
    notes: string[];
  };
  safetyRules: string[];
  examplePrompts: {
    codex: string;
    gemini: string;
  };
  examples: {
    createDraft: LayoutBuilderCreateBrandDraftRequest;
    importSpec: LayoutBuilderCreateBrandDraftFromSpecRequest;
    aiBrandSpec: LayoutBuilderAiBrandSpec;
  };
}

export interface LayoutBuilderBrandIntentManifest {
  manifestVersion: string;
  purpose: string;
  recommendedFlow: "external_chat_intent";
  endpoints: LayoutBuilderAgentManifestEndpoint[];
  codexPrompt: {
    system: string;
    userQuestions: Array<{
      id: string;
      label: string;
      prompt: string;
      required: boolean;
      reason: string;
    }>;
    outputContract: string[];
  };
  requiredCapabilities: Array<"auth" | "account" | "balances" | "payments" | "customers" | "paymentMethods" | "paymentCreation">;
  schema: unknown;
  hiddenBffConfig: {
    generatedBy: "layout-builder";
    storedAs: "generationProfile.dictionary";
    clientVisibility: "brand runtime receives only public aliases, labels, UI tokens, and brand routes";
    includes: Array<keyof LayoutBuilderBrandRuntimeDictionary>;
  };
  rules: {
    doNotMention: string[];
    routeGuidance: string[];
    uniquenessGuidance: string[];
    requiredVariation: string[];
  };
  examples: {
    promptForChat: string;
    intent: LayoutBuilderBrandGenerationIntent;
  };
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
  aiSpec?: LayoutBuilderAiBrandSpec;
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
  aiProvider?: LayoutBuilderAiProvider;
  aiModel?: string;
  clarificationAnswers?: LayoutBuilderClarificationAnswers;
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
