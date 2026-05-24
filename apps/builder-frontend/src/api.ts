import type {
  HealthResponse,
  LayoutBuilderAdminAuthResponse,
  LayoutBuilderAppendBrandDraftMessageRequest,
  LayoutBuilderBrandGenerationDraft,
  LayoutBuilderAdminLoginRequest,
  LayoutBuilderAiProvider,
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandMembership,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderClarificationAnswers,
  LayoutBuilderClarifyBrandResponse,
  LayoutBuilderCreateBrandDraftRequest,
  LayoutBuilderContractVersionRecord,
  LayoutBuilderDeleteBrandResponse,
  LayoutBuilderRegenerateContractRequest,
  ReceiptRecognitionModel,
  ReceiptRecognizerRawTextResponse,
  ReceiptRecognizerReceiptResponse,
  ReceiptRecognizerUploadReceiptResponse,
  SmsGatewaySendSmsRequest
} from "@payment-ops/shared-types";

export interface SmsSendResponse {
  jobId: string;
  status: SmsStatus;
  provider: string;
  deduplicated: boolean;
}

export interface SmsStatusResponse {
  jobId: string;
  status: SmsStatus;
  provider: string;
  attempts: number;
  lastError: string | null;
}

export interface SmsRecentMessageResponse extends SmsStatusResponse {
  phoneNumber: string;
  message: string;
  dedupeKey: string | null;
  createdAt: string;
  sentAt: string | null;
}

export type SmsStatus = "queued" | "processing" | "sent" | "failed";

const apiBases = {
  brandRuntime: import.meta.env.VITE_BRAND_RUNTIME_BASE ?? "http://localhost:3006",
  sms: import.meta.env.VITE_SMS_API_BASE ?? "/sms-api",
  receipt: import.meta.env.VITE_RECEIPT_API_BASE ?? "/receipt-api",
  layout: import.meta.env.VITE_LAYOUT_API_BASE ?? "/layout-api"
};

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details.length > 0 ? details : `${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function endpointPath(endpoint: string): string {
  return endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
}

function publicUrl(baseUrl: string, endpoint: string): string {
  if (/^https?:\/\//u.test(endpoint)) {
    return endpoint;
  }

  return `${baseUrl}${endpointPath(endpoint)}`;
}

function brandRuntimePath(appUrl: string): string {
  const path = endpointPath(appUrl);
  const withoutProxyPrefix = path.replace(/^\/brand-runtime/u, "");

  return withoutProxyPrefix.replace(/\/app$/u, "/dashboard");
}

function adminAuthHeaders(): HeadersInit | undefined {
  const token = window.localStorage.getItem("layout-admin-session");
  return token ? { authorization: `Bearer ${token}` } : undefined;
}

function withAdminAuth(init: RequestInit = {}): RequestInit {
  const headers = adminAuthHeaders();

  return headers ? { ...init, headers: { ...(init.headers as Record<string, string> | undefined), ...headers } } : init;
}

export const api = {
  health: {
    sms: () => requestJson<HealthResponse>(apiBases.sms, "/health"),
    receipt: () => requestJson<HealthResponse>(apiBases.receipt, "/health"),
    layout: () => requestJson<HealthResponse>(apiBases.layout, "/health")
  },
  sms: {
    send: (payload: SmsGatewaySendSmsRequest) =>
      requestJson<SmsSendResponse>(apiBases.sms, "/sms/send", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      }),
    recent: () => requestJson<SmsRecentMessageResponse[]>(apiBases.sms, "/sms/recent"),
    status: (jobId: string) =>
      requestJson<SmsStatusResponse>(apiBases.sms, `/sms/status/${encodeURIComponent(jobId)}`)
  },
  receipts: {
    upload: (file: File, model: ReceiptRecognitionModel) => {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("model", model);

      return requestJson<ReceiptRecognizerUploadReceiptResponse>(apiBases.receipt, "/receipts/upload", {
        method: "POST",
        body: formData
      });
    },
    recent: () => requestJson<ReceiptRecognizerReceiptResponse[]>(apiBases.receipt, "/receipts/recent"),
    get: (receiptId: string) =>
      requestJson<ReceiptRecognizerReceiptResponse>(
        apiBases.receipt,
        `/receipts/${encodeURIComponent(receiptId)}`
      ),
    raw: (receiptId: string) =>
      requestJson<ReceiptRecognizerRawTextResponse>(
        apiBases.receipt,
        `/receipts/${encodeURIComponent(receiptId)}/raw`
      )
  },
  layout: {
    adminDevSession: () =>
      requestJson<LayoutBuilderAdminAuthResponse>(apiBases.layout, "/admin/auth/dev-session", {
        method: "POST"
      }),
    adminLogin: (payload: LayoutBuilderAdminLoginRequest) =>
      requestJson<LayoutBuilderAdminAuthResponse>(apiBases.layout, "/admin/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      }),
    adminMe: (sessionToken?: string) =>
      requestJson<LayoutBuilderAdminAuthResponse>(
        apiBases.layout,
        "/admin/auth/me",
        sessionToken ? { headers: { authorization: `Bearer ${sessionToken}` } } : undefined
      ),
    brandMemberships: (brandId: string) =>
      requestJson<LayoutBuilderBrandMembership[]>(
        apiBases.layout,
        `/admin/brands/${encodeURIComponent(brandId)}/memberships`,
        withAdminAuth()
      ),
    createBrand: (brandName: string, logo: File | Blob) => {
      const formData = new FormData();
      formData.set("brandName", brandName);
      formData.set("logo", logo, logo instanceof File ? logo.name : "demo-mark.svg");

      return requestJson<LayoutBuilderBrandResponse>(apiBases.layout, "/brands", withAdminAuth({
        method: "POST",
        body: formData
      }));
    },
    createAiBrand: (input: {
      brandName: string;
      logo: File | Blob;
      aiPrompt: string;
      systemPrompt: string;
      aiProvider?: LayoutBuilderAiProvider;
      aiModel?: string;
      clarificationAnswers?: LayoutBuilderClarificationAnswers;
    }) => {
      const formData = new FormData();
      formData.set("brandName", input.brandName);
      formData.set("aiPrompt", input.aiPrompt);
      formData.set("systemPrompt", input.systemPrompt);
      formData.set("aiProvider", input.aiProvider ?? "local");
      if (input.aiModel) {
        formData.set("aiModel", input.aiModel);
      }
      if (input.clarificationAnswers) {
        formData.set("clarificationAnswers", JSON.stringify(input.clarificationAnswers));
      }
      formData.set("logo", input.logo, input.logo instanceof File ? input.logo.name : "demo-mark.svg");

      return requestJson<LayoutBuilderBrandResponse>(apiBases.layout, "/brands/ai", withAdminAuth({
        method: "POST",
        body: formData
      }));
    },
    clarifyAiBrand: (input: {
      brandName: string;
      aiPrompt: string;
      aiProvider?: LayoutBuilderAiProvider;
      aiModel?: string;
    }) =>
      requestJson<LayoutBuilderClarifyBrandResponse>(apiBases.layout, "/brands/ai/clarify", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          brandName: input.brandName,
          aiPrompt: input.aiPrompt,
          aiProvider: input.aiProvider ?? "local",
          ...(input.aiModel ? { aiModel: input.aiModel } : {})
        })
      }),
    createBrandDraft: (payload: LayoutBuilderCreateBrandDraftRequest) =>
      requestJson<LayoutBuilderBrandGenerationDraft>(apiBases.layout, "/brands/ai/drafts", withAdminAuth({
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      })),
    appendBrandDraftMessage: (draftId: string, payload: LayoutBuilderAppendBrandDraftMessageRequest) =>
      requestJson<LayoutBuilderBrandGenerationDraft>(
        apiBases.layout,
        `/brands/ai/drafts/${encodeURIComponent(draftId)}/messages`,
        withAdminAuth({
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        })
      ),
    getBrandDraft: (draftId: string) =>
      requestJson<LayoutBuilderBrandGenerationDraft>(
        apiBases.layout,
        `/brands/ai/drafts/${encodeURIComponent(draftId)}`,
        withAdminAuth()
      ),
    createBrandFromDraft: (draftId: string, logo: File | Blob) => {
      const formData = new FormData();
      formData.set("logo", logo, logo instanceof File ? logo.name : "demo-mark.svg");

      return requestJson<LayoutBuilderBrandResponse>(
        apiBases.layout,
        `/brands/ai/drafts/${encodeURIComponent(draftId)}/create`,
        withAdminAuth({
          method: "POST",
          body: formData
        })
      );
    },
    recent: () => requestJson<LayoutBuilderBrandListItem[]>(apiBases.layout, "/brands/recent"),
    schema: (brandId: string) =>
      requestJson<LayoutBuilderBrandSchemaResponse>(
        apiBases.layout,
        `/brands/${encodeURIComponent(brandId)}/schema`
      ),
    contractVersions: (brandId: string) =>
      requestJson<LayoutBuilderContractVersionRecord[]>(
        apiBases.layout,
        `/brands/${encodeURIComponent(brandId)}/contract-versions`,
        withAdminAuth()
      ),
    regenerateContractVersion: (brandId: string, payload: LayoutBuilderRegenerateContractRequest = {}) =>
      requestJson<LayoutBuilderBrandSchemaResponse>(
        apiBases.layout,
        `/brands/${encodeURIComponent(brandId)}/contract-versions/regenerate`,
        withAdminAuth({
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        })
      ),
    activateContractVersion: (brandId: string, contractVersionId: string) =>
      requestJson<LayoutBuilderBrandSchemaResponse>(
        apiBases.layout,
        `/brands/${encodeURIComponent(brandId)}/contract-versions/${encodeURIComponent(contractVersionId)}/activate`,
        withAdminAuth({
          method: "POST"
        })
      ),
    runtimeConfig: <TContract>(endpoint: string) =>
      requestJson<TContract>(apiBases.layout, `${endpointPath(endpoint)}/runtime/config`),
    runtimeAdminResources: <TResources>(endpoint: string) =>
      requestJson<TResources>(apiBases.layout, `${endpointPath(endpoint)}/runtime/admin/resources`, withAdminAuth()),
    runtimeRequestLogs: <TLogs>(endpoint: string) =>
      requestJson<TLogs>(apiBases.layout, `${endpointPath(endpoint)}/runtime/admin/request-logs`, withAdminAuth()),
    seedRuntimeDemoData: <TResources>(endpoint: string) =>
      requestJson<TResources>(apiBases.layout, `${endpointPath(endpoint)}/runtime/admin/seed`, withAdminAuth({
        method: "POST",
      })),
    resetRuntimeDemoData: <TResources>(endpoint: string) =>
      requestJson<TResources>(apiBases.layout, `${endpointPath(endpoint)}/runtime/admin/reset-demo`, withAdminAuth({
        method: "POST",
      })),
    deleteBrand: (brandId: string) =>
      requestJson<LayoutBuilderDeleteBrandResponse>(
        apiBases.layout,
        `/brands/${encodeURIComponent(brandId)}`,
        withAdminAuth({
          method: "DELETE",
        })
      ),
    brandRuntimeUrl: (appUrl: string) => publicUrl(apiBases.brandRuntime, brandRuntimePath(appUrl)),
    publicUrl: (endpoint: string) => publicUrl(apiBases.layout, endpoint),
  }
};
