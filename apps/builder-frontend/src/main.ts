import type {
  HealthResponse,
  LayoutBuilderAdminAuthResponse,
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandGenerationDraft,
  LayoutBuilderBrandGenerationIntent,
  LayoutBuilderBrandMembership,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderClarificationAnswers,
  LayoutBuilderContractVersionRecord,
  LayoutBuilderCreateBrandIntentDraftRequest,
  ReceiptRecognitionModel,
  ReceiptRecognizerReceiptResponse
} from "@payment-ops/shared-types";

import { api, infraUrls, type SmsRecentMessageResponse, type SmsStatusResponse } from "./api.js";
import "./styles.css";

interface LayoutState {
  activeBrand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem | null;
  activeSchema: LayoutBuilderBrandSchemaResponse | null;
  activeRuntimeContract: BrandRuntimeContract | null;
  activeRuntimeResources: BrandRuntimeResources | null;
  activeRuntimeRequestLogs: BrandRuntimeRequestLog[];
  activeContractVersions: LayoutBuilderContractVersionRecord[];
  activeAdminSession: LayoutBuilderAdminAuthResponse | null;
  activeBrandMemberships: LayoutBuilderBrandMembership[];
  activeBrandDraft: LayoutBuilderBrandGenerationDraft | null;
}

interface BrandRuntimeContract {
  brandId: string;
  brandName: string;
  resourceAlias: string;
  statusMap: Record<string, string>;
  actionLabels: Record<string, string>;
  fields: Record<string, string>;
  accountFields: Record<string, string>;
  balanceFields: Record<string, string>;
  customerFields: Record<string, string>;
  paymentMethodFields: Record<string, string>;
  userFields: Record<string, string>;
  authFields: Record<string, string>;
  endpoints: Record<string, string>;
}

interface BrandRuntimeResources {
  accounts: Array<Record<string, unknown>>;
  balanceTransactions: Array<Record<string, unknown>>;
  customers: Array<Record<string, unknown>>;
  demoSessionToken?: string;
  paymentIntents: Array<Record<string, unknown>>;
  paymentMethods: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
}

interface BrandRuntimeRequestLog {
  requestLogId: string;
  method: "GET" | "POST";
  alias: string;
  publicEndpoint: string;
  operation: string;
  status: "success" | "error";
  durationMs: number;
  errorMessage: string | null;
  createdAt: string;
}

type DemoRoute = "sms" | "receipts" | "layouts";

const ROUTES: readonly DemoRoute[] = ["sms", "receipts", "layouts"];

const layoutState: LayoutState = {
  activeBrand: null,
  activeSchema: null,
  activeRuntimeContract: null,
  activeRuntimeResources: null,
  activeRuntimeRequestLogs: [],
  activeContractVersions: [],
  activeAdminSession: null,
  activeBrandMemberships: [],
  activeBrandDraft: null
};
let recentLayoutBrands: LayoutBuilderBrandListItem[] = [];

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <header class="topbar">
    <div>
      <p class="eyebrow">Payment Ops Prototype</p>
      <h1>Local demo console</h1>
    </div>
    <div class="topbar-actions">
      <a class="button secondary infra-link" href="${infraUrls.postgresViewer}" target="_blank" rel="noreferrer">Postgres</a>
      <a class="button secondary infra-link" href="${infraUrls.redisViewer}" target="_blank" rel="noreferrer">Redis</a>
      <div class="admin-chip" id="admin-chip">
        <span>Admin</span>
        <strong>Not signed in</strong>
      </div>
      <button class="button secondary" id="open-admin-login" type="button">Admin login</button>
      <button class="button secondary" id="refresh-all" type="button">Refresh</button>
    </div>
  </header>

  <main class="shell">
    <nav class="tabs" aria-label="Demo services">
      <a href="#sms" class="tab-link" data-route="sms">SMS Gateway</a>
      <a href="#receipts" class="tab-link" data-route="receipts">Receipt Recognizer</a>
      <a href="#layouts" class="tab-link" data-route="layouts">Layout Builder</a>
    </nav>

    <section class="workspace">
      <article class="panel route-section sms-panel" data-route-section="sms">
        <article class="status-card inline-status" id="health-sms">
          <span class="status-dot muted"></span>
          <div>
            <strong>SMS Gateway</strong>
            <span>Checking</span>
          </div>
        </article>
        <div class="panel-header">
          <div>
            <p class="eyebrow">Phase 2</p>
            <h2>SMS send and status</h2>
          </div>
          <button class="icon-button" id="sms-refresh" type="button" title="Refresh SMS messages">↻</button>
        </div>
        <form id="sms-form" class="form-grid">
          <label>
            Phone
            <input name="phoneNumber" value="+919876543210" autocomplete="tel" required />
          </label>
          <label>
            Message
            <textarea name="message" rows="3" required>Your OTP is 123456</textarea>
          </label>
          <button class="button" type="submit">Send SMS</button>
        </form>
        <div class="callout" id="sms-result">No SMS request sent yet.</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Job</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody id="sms-recent"></tbody>
          </table>
        </div>
      </article>

      <article class="panel route-section receipt-panel" data-route-section="receipts">
        <article class="status-card inline-status" id="health-receipt">
          <span class="status-dot muted"></span>
          <div>
            <strong>Receipt Recognizer</strong>
            <span>Checking</span>
          </div>
        </article>
        <div class="panel-header">
          <div>
            <p class="eyebrow">Phase 3</p>
            <h2>Receipt recognition</h2>
          </div>
          <button class="icon-button" id="receipt-refresh" type="button" title="Refresh receipts">↻</button>
        </div>
        <form id="receipt-form" class="form-grid">
          <label>
            Receipt image
            <input name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
          </label>
          <label>
            Model
            <select name="model">
              <option value="tesseract">tesseract</option>
              <option value="gemini">gemini</option>
            </select>
          </label>
          <button class="button" type="submit">Upload receipt</button>
        </form>
        <div class="result-grid" id="receipt-result">
          <div class="empty">Upload a PhonePe receipt image to see normalized payment fields.</div>
        </div>
        <details class="raw-block">
          <summary>Raw OCR text</summary>
          <pre id="receipt-raw">No raw text loaded.</pre>
        </details>
        <div class="list" id="receipt-history"></div>
      </article>

      <article class="panel route-section layout-panel" data-route-section="layouts">
        <div class="layout-toolbar">
          <div>
            <p class="eyebrow">Brand runtime console</p>
            <h2>Payment gateway brands</h2>
          </div>
          <div class="layout-toolbar-actions">
            <article class="status-card inline-status" id="health-layout">
              <span class="status-dot muted"></span>
              <div>
                <strong>Layout Builder</strong>
                <span>Checking</span>
              </div>
            </article>
            <button class="button secondary" id="seed-brand-demo" type="button" disabled>Seed demo data</button>
            <button class="button secondary" id="reset-brand-demo" type="button" disabled>Reset demo data</button>
            <button class="button secondary" id="open-demo-merchant" type="button" disabled>Open as demo merchant</button>
            <button class="button secondary" id="open-brand-app" type="button" disabled>Open user app</button>
          </div>
        </div>
        <div class="layout-workbench">
          <aside class="brand-sidebar">
            <div class="sidebar-header">
              <h3>Brands</h3>
              <div class="sidebar-actions">
                <button class="button secondary compact-action" id="open-brand-modal" type="button">Create AI brand</button>
                <button class="icon-button" id="layout-refresh" type="button" title="Refresh brands">↻</button>
              </div>
            </div>
            <div class="api-only-note">
              <strong>External chat intent</strong>
              <span>Generate intent in ChatGPT/Codex/Gemini, paste JSON here, and let the backend compile integration.</span>
            </div>
            <div class="list compact" id="brand-list"></div>
            <button class="button danger sidebar-delete" id="delete-brand" type="button" disabled>Delete selected</button>
          </aside>

          <section class="preview-column">
            <div class="preview-header">
              <div>
                <h3>Brand runtime preview</h3>
                <div class="selected-brand" id="selected-brand-title">No brand selected</div>
              </div>
            </div>
            <div class="live-preview" id="live-preview">
              <div class="empty">Select a brand to load the preview.</div>
            </div>

            <aside class="inspector-sidebar">
              <div class="inspector-header">
                <h3>Integration</h3>
                <span>Contract, seed state, and generated frontend versions</span>
              </div>
              <div class="contract-inspector" id="contract-inspector"></div>
            </aside>
          </section>

        </div>
      </article>
    </section>
  </main>

  <div class="modal-backdrop" id="admin-modal" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="admin-modal-title">
      <div class="modal-header">
        <h3 id="admin-modal-title">Admin login</h3>
        <button class="icon-button" id="close-admin-modal" type="button" aria-label="Close admin login dialog">X</button>
      </div>
      <form id="admin-form" class="form-grid">
        <label>
          Email
          <input name="email" value="admin@payment-ops.local" type="email" required />
        </label>
        <label>
          Password
          <input name="password" value="local-admin-password" type="password" required />
        </label>
        <div class="button-row">
          <button class="button" type="submit">Sign in</button>
          <button class="button secondary" id="use-dev-admin" type="button">Use dev session</button>
          <button class="button secondary" id="admin-logout" type="button">Logout</button>
        </div>
        <span class="modal-status" id="admin-modal-status"></span>
      </form>
    </section>
  </div>

  <div class="modal-backdrop" id="brand-modal" hidden>
    <section class="modal brand-modal-shell" role="dialog" aria-modal="true" aria-labelledby="brand-modal-title">
      <div class="modal-header">
        <div>
          <p class="eyebrow">External chat brand flow</p>
          <h3 id="brand-modal-title">Create brand from intent</h3>
        </div>
        <button class="icon-button" id="close-brand-modal" type="button" aria-label="Close brand dialog">X</button>
      </div>
      <form id="brand-form" class="form-grid">
        <label>
          Brand intent JSON
          <textarea name="intentJson" rows="18" spellcheck="false" required>${escapeHtml(defaultBrandIntentJson())}</textarea>
        </label>
        <label>
          Admin note
          <textarea name="adminPrompt" rows="3">External chat generated this brand intent. Backend compiles it into the hidden payment gateway contract.</textarea>
        </label>
        <details class="prompt-details">
          <summary>Compiler controls</summary>
          <div class="form-grid two-col">
            <label>
              Source
              <select name="source">
                <option value="external-chat">External chat</option>
                <option value="codex">Codex</option>
                <option value="gemini">Gemini chat</option>
                <option value="claude">Claude chat</option>
                <option value="manual">Manual JSON</option>
              </select>
            </label>
            <label>
              Fields
              <select name="fieldStyle">
                <option value="snake_case">snake_case</option>
                <option value="camelCase">camelCase</option>
                <option value="kebab-case">kebab-case</option>
              </select>
            </label>
            <label>
              Payload
              <select name="payloadStructure">
                <option value="nested">Nested</option>
                <option value="flat">Flat</option>
                <option value="key-value-array">Key-value array</option>
              </select>
            </label>
            <label>
              Envelope
              <select name="responseEnvelope">
                <option value="resource_key">Resource key</option>
                <option value="data">Data</option>
                <option value="result">Result</option>
                <option value="plain">Plain</option>
              </select>
            </label>
          </div>
        </details>
        <label>
          Logo
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
        </label>
        <div class="draft-preview" id="brand-draft-preview">
          <div class="assistant-empty">
            <strong>No intent compiled yet.</strong>
            <span>Paste JSON from ChatGPT/Codex/Gemini, then click Compile preview.</span>
          </div>
        </div>
        <div class="modal-footer">
          <span class="modal-status" id="brand-modal-status"></span>
          <button class="button secondary" id="brand-preview-spec" type="button">Compile preview</button>
          <button class="button" id="brand-create-approved" type="submit" disabled>Create brand</button>
        </div>
      </form>
    </section>
  </div>
`;

const refreshAllButton = required<HTMLButtonElement>("#refresh-all");
const adminChip = required<HTMLElement>("#admin-chip");
const adminForm = required<HTMLFormElement>("#admin-form");
const adminModal = required<HTMLElement>("#admin-modal");
const adminModalStatus = required<HTMLElement>("#admin-modal-status");
const brandModal = required<HTMLElement>("#brand-modal");
const brandForm = required<HTMLFormElement>("#brand-form");
const brandModalStatus = required<HTMLElement>("#brand-modal-status");
const brandDraftPreview = required<HTMLElement>("#brand-draft-preview");
const brandCreateButton = required<HTMLButtonElement>("#brand-create-approved");
const smsForm = required<HTMLFormElement>("#sms-form");
const smsResult = required<HTMLElement>("#sms-result");
const smsRecent = required<HTMLElement>("#sms-recent");
const receiptForm = required<HTMLFormElement>("#receipt-form");
const receiptResult = required<HTMLElement>("#receipt-result");
const receiptRaw = required<HTMLPreElement>("#receipt-raw");
const receiptHistory = required<HTMLElement>("#receipt-history");
const brandList = required<HTMLElement>("#brand-list");
const selectedBrandTitle = required<HTMLElement>("#selected-brand-title");
const contractInspector = required<HTMLElement>("#contract-inspector");
const openBrandAppButton = required<HTMLButtonElement>("#open-brand-app");
const openDemoMerchantButton = required<HTMLButtonElement>("#open-demo-merchant");
const resetBrandDemoButton = required<HTMLButtonElement>("#reset-brand-demo");
const seedBrandDemoButton = required<HTMLButtonElement>("#seed-brand-demo");
const deleteBrandButton = required<HTMLButtonElement>("#delete-brand");
const livePreview = required<HTMLElement>("#live-preview");

window.addEventListener("hashchange", () => {
  void setActiveRoute(routeFromHash());
});

refreshAllButton.addEventListener("click", () => {
  void refreshAll();
});

required<HTMLButtonElement>("#sms-refresh").addEventListener("click", () => {
  void refreshSms();
});

required<HTMLButtonElement>("#receipt-refresh").addEventListener("click", () => {
  void refreshReceipts();
});

required<HTMLButtonElement>("#layout-refresh").addEventListener("click", () => {
  void refreshBrands();
});

required<HTMLButtonElement>("#open-brand-modal").addEventListener("click", () => {
  openBrandModal();
});

required<HTMLButtonElement>("#close-brand-modal").addEventListener("click", () => {
  closeBrandModal();
});

required<HTMLButtonElement>("#brand-preview-spec").addEventListener("click", () => {
  void previewBrandSpec();
});

brandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void createApprovedBrand();
});

brandModal.addEventListener("click", (event) => {
  if (event.target === brandModal) {
    closeBrandModal();
  }
});

required<HTMLButtonElement>("#open-admin-login").addEventListener("click", () => {
  openAdminModal();
});

required<HTMLButtonElement>("#close-admin-modal").addEventListener("click", () => {
  closeAdminModal();
});

required<HTMLButtonElement>("#use-dev-admin").addEventListener("click", () => {
  void createDevAdminSession();
});

required<HTMLButtonElement>("#admin-logout").addEventListener("click", () => {
  logoutAdmin();
});

adminModal.addEventListener("click", (event) => {
  if (event.target === adminModal) {
    closeAdminModal();
  }
});

smsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void sendSms();
});

receiptForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void uploadReceipt();
});

adminForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void loginAdmin();
});

deleteBrandButton.addEventListener("click", () => {
  void deleteActiveBrand();
});

seedBrandDemoButton.addEventListener("click", () => {
  void seedActiveBrandDemoData();
});

resetBrandDemoButton.addEventListener("click", () => {
  void resetActiveBrandDemoData();
});

contractInspector.addEventListener("click", (event) => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const regenerateButton = target.closest<HTMLButtonElement>("[data-regenerate-contract]");
  if (regenerateButton) {
    void regenerateActiveContractVersion();
    return;
  }

  const activateButton = target.closest<HTMLButtonElement>("[data-activate-contract-version]");
  const contractVersionId = activateButton?.dataset.activateContractVersion;

  if (contractVersionId) {
    void activateContractVersion(contractVersionId);
  }
});

openDemoMerchantButton.addEventListener("click", () => {
  openActiveBrandAsDemoMerchant();
});

openBrandAppButton.addEventListener("click", () => {
  const brand = layoutState.activeBrand;

  if (brand) {
    window.open(brandUserAppUrl(brand), "_blank", "noopener,noreferrer");
  }
});

void setActiveRoute(routeFromHash());
void refreshAll();

function required<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing element: ${selector}`);
  }

  return element;
}

function openBrandModal(): void {
  brandModal.hidden = false;
  brandModalStatus.textContent = "";
  layoutState.activeBrandDraft = null;
  brandCreateButton.disabled = true;
  brandDraftPreview.innerHTML = `
    <div class="assistant-empty">
      <strong>No intent compiled yet.</strong>
      <span>Paste JSON from ChatGPT/Codex/Gemini, then click Compile preview.</span>
    </div>
  `;
  brandForm.querySelector<HTMLTextAreaElement>('textarea[name="intentJson"]')?.focus();
}

function closeBrandModal(): void {
  brandModal.hidden = true;
  brandModalStatus.textContent = "";
}

async function previewBrandSpec(): Promise<void> {
  let payload: LayoutBuilderCreateBrandIntentDraftRequest;

  try {
    payload = brandDraftPayload();
  } catch (error) {
    brandModalStatus.textContent = errorMessage(error);
    return;
  }

  setBusy(brandForm, true);
  brandModalStatus.textContent = "Compiling intent...";

  try {
    const draft = await api.layout.createBrandIntentDraft(payload);
    layoutState.activeBrandDraft = draft;
    renderBrandDraftPreview(draft);
    brandCreateButton.disabled = draft.status !== "valid";
    brandModalStatus.textContent = draft.status === "valid" ? "Intent compiled. You can create the brand." : "Intent needs changes before create.";
  } catch (error) {
    brandModalStatus.textContent = errorMessage(error);
  } finally {
    setBusy(brandForm, false);
    brandCreateButton.disabled = layoutState.activeBrandDraft?.status !== "valid";
  }
}

async function createApprovedBrand(): Promise<void> {
  const draft = layoutState.activeBrandDraft;

  if (!draft || draft.status !== "valid") {
    brandModalStatus.textContent = "Generate a valid spec first.";
    return;
  }

  setBusy(brandForm, true);
  brandModalStatus.textContent = "Creating brand...";

  try {
    const brand = await api.layout.createBrandFromIntentDraft(draft.draftId, brandLogoFile());
    closeBrandModal();
    await refreshBrands();
    await selectBrand(brand.brandId);
  } catch (error) {
    brandModalStatus.textContent = errorMessage(error);
  } finally {
    setBusy(brandForm, false);
  }
}

function brandDraftPayload(): LayoutBuilderCreateBrandIntentDraftRequest {
  const intent = parseBrandIntent(formValue("intentJson"));
  const fieldStyle = formValue("fieldStyle") as "camelCase" | "snake_case" | "kebab-case";

  return {
    intent: {
      ...intent,
      namingRules: {
        ...intent.namingRules,
        fieldStyle
      }
    },
    adminPrompt: formValue("adminPrompt"),
    source: formValue("source") as "external-chat" | "codex" | "gemini" | "claude" | "manual",
    controls: {
      payloadStructure: formValue("payloadStructure") as "flat" | "nested" | "key-value-array",
      fieldStyle,
      authShape: "workspace",
      responseEnvelope: formValue("responseEnvelope") as "plain" | "resource_key" | "data" | "result",
      routeNaming: "finance",
      errorStyle: "branded",
      namingIntensity: "maximum"
    }
  };
}

function parseBrandIntent(value: string): LayoutBuilderBrandGenerationIntent {
  const parsed = JSON.parse(value) as unknown;

  if (!parsed || typeof parsed !== "object" || !("brandName" in parsed)) {
    throw new Error("Intent JSON must include brandName, concept, namingRules, uiDirection, and copy.");
  }

  return parsed as LayoutBuilderBrandGenerationIntent;
}

function defaultBrandIntentJson(): string {
  return JSON.stringify(
    {
      brandName: "Copper Harbor",
      concept: {
        domain: "merchant acquiring for regional commerce teams",
        audience: "market operators",
        productMetaphor: "harbor control",
        authMetaphor: "dock pass",
        paymentMetaphor: "cargo clearing",
        tone: "practical port-operations finance language",
        avoidWords: ["stripe", "payment-core", "bff", "runtime", "profile"],
        preferredTerms: ["harbor", "dock", "cargo", "operator", "berth", "tide"]
      },
      namingRules: {
        routeStyle: "short operational harbor terms without generic payment words",
        fieldStyle: "snake_case",
        forbiddenCanonicalNames: ["payments", "customers", "balances", "account", "metrics", "profile"],
        examples: ["cargo-ledger", "dock-pass", "tide-stream", "operator-book"]
      },
      uiDirection: {
        layout: "split-workspace",
        density: "balanced",
        navigation: "command-rail",
        visualStyle: "split harbor operations workspace with muted copper surfaces, steel borders, and tide-blue action states",
        palette: ["copper", "steel", "tide blue", "white"],
        dashboardBlocks: ["metrics", "recentPayments", "balances", "createPayment"]
      },
      copy: {
        loginTitle: "Enter dock",
        registerTitle: "Issue dock pass",
        emptyStates: {
          payments: "No cargo clearings have been logged.",
          customers: "No operators are in the harbor book.",
          balances: "No tide stream movements are posted."
        },
        actionLabels: {
          createPayment: "Clear cargo",
          history: "Cargo ledger",
          refund: "Reverse cargo",
          overview: "Harbor board",
          payments: "Cargo clearings",
          customers: "Operator book",
          balances: "Tide stream"
        }
      },
      statusVocabulary: {
        created: "cargoLogged",
        requires_payment_method: "berthMissing",
        requires_confirmation: "dockReview",
        processing: "tideMoving",
        authorized: "harborHold",
        captured: "cargoSecured",
        settled: "cargoCleared",
        failed: "dockRejected",
        canceled: "cargoVoided",
        refunded: "cargoReturned"
      }
    },
    null,
    2
  );
}

function renderBrandDraftPreview(draft: LayoutBuilderBrandGenerationDraft): void {
  const routes = draft.spec ? Object.entries(draft.spec.entities).map(([name, entity]) => `${name}: /${entity.route}`) : [];
  const presentation = draft.spec?.ui.presentation;

  brandDraftPreview.innerHTML = `
    <div class="draft-preview-header">
      <span>${escapeHtml(draft.provider)} · ${escapeHtml(draft.model)}</span>
      <strong>${escapeHtml(draft.brandName)} spec</strong>
    </div>
    ${
      draft.validationIssues.length > 0
        ? `<div class="status error">${draft.validationIssues.map((issue) => escapeHtml(issue)).join("<br />")}</div>`
        : `<div class="status">Ready to create.</div>`
    }
    <div class="contract-grid compact">
      ${contractMetric("routes", routes.length)}
      ${contractMetric("issues", draft.validationIssues.length)}
      ${contractMetric("messages", draft.messages.length)}
    </div>
    ${
      presentation
        ? `<div class="api-only-note"><strong>${escapeHtml(presentation.layout)} · ${escapeHtml(presentation.density)}</strong><span>${escapeHtml(presentation.copyTone)}</span></div>`
        : ""
    }
    <details class="contract-json" open>
      <summary>Public routes</summary>
      <pre>${escapeHtml(routes.join("\n"))}</pre>
    </details>
  `;
}

function formValue(name: string): string {
  const control = brandForm.elements.namedItem(name);

  return control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement || control instanceof HTMLSelectElement
    ? control.value.trim()
    : "";
}

function brandLogoFile(): File | Blob {
  const input = brandForm.elements.namedItem("logo");

  if (input instanceof HTMLInputElement && input.files?.[0]) {
    return input.files[0];
  }

  return new Blob([`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="18" fill="#17202a"/><path d="M24 60c16-32 32-32 48 0" fill="none" stroke="#9fffd0" stroke-width="10" stroke-linecap="round"/><circle cx="66" cy="30" r="10" fill="#f5c542"/></svg>`], {
    type: "image/svg+xml"
  });
}

async function refreshAll(): Promise<void> {
  await Promise.allSettled([refreshHealth(), refreshSms(), refreshReceipts(), refreshAdminSession(), refreshBrands()]);
}

function routeFromHash(): DemoRoute {
  const hash = window.location.hash.replace("#", "");

  if (ROUTES.includes(hash as DemoRoute)) {
    return hash as DemoRoute;
  }

  window.history.replaceState(null, "", "#sms");
  return "sms";
}

async function setActiveRoute(route: DemoRoute): Promise<void> {
  document.querySelectorAll<HTMLElement>("[data-route-section]").forEach((section) => {
    section.hidden = section.dataset.routeSection !== route;
  });

  document.querySelectorAll<HTMLAnchorElement>("[data-route]").forEach((link) => {
    const isActive = link.dataset.route === route;
    link.classList.toggle("active", isActive);
    link.setAttribute("aria-current", isActive ? "page" : "false");
  });

  if (route === "sms") {
    await Promise.allSettled([paintHealth("health-sms", api.health.sms()), refreshSms()]);
    return;
  }

  if (route === "receipts") {
    await Promise.allSettled([paintHealth("health-receipt", api.health.receipt()), refreshReceipts()]);
    return;
  }

  await Promise.allSettled([paintHealth("health-layout", api.health.layout()), refreshAdminSession(), refreshBrands()]);
}

async function refreshAdminSession(): Promise<void> {
  try {
    const storedToken = window.localStorage.getItem("layout-admin-session") ?? undefined;
    if (!storedToken) {
      layoutState.activeAdminSession = null;
      renderAdminSession();
      return;
    }

    const session = await api.layout.adminMe(storedToken);
    layoutState.activeAdminSession = session;
    window.localStorage.setItem("layout-admin-session", session.sessionToken);
  } catch {
    layoutState.activeAdminSession = null;
    window.localStorage.removeItem("layout-admin-session");
  } finally {
    renderAdminSession();
  }
}

function renderAdminSession(): void {
  const session = layoutState.activeAdminSession;
  adminChip.innerHTML = session
    ? `<span>${escapeHtml(session.admin.role)}</span><strong>${escapeHtml(session.admin.email)}</strong>`
    : "<span>Admin</span><strong>Not signed in</strong>";
}

async function refreshHealth(): Promise<void> {
  await Promise.all([
    paintHealth("health-sms", api.health.sms()),
    paintHealth("health-receipt", api.health.receipt()),
    paintHealth("health-layout", api.health.layout())
  ]);
}

async function paintHealth(elementId: string, healthPromise: Promise<HealthResponse>): Promise<void> {
  const element = required<HTMLElement>(`#${elementId}`);
  const dot = element.querySelector<HTMLElement>(".status-dot");
  const text = element.querySelector<HTMLElement>("span:last-child");

  if (!dot || !text) {
    return;
  }

  try {
    const health = await healthPromise;
    dot.className = `status-dot ${health.status === "ok" ? "ok" : "warn"}`;
    text.textContent = `${health.status} · ${Math.round(health.uptimeSeconds)}s`;
  } catch (error) {
    dot.className = "status-dot bad";
    text.textContent = errorMessage(error);
  }
}

async function sendSms(): Promise<void> {
  const formData = new FormData(smsForm);
  const phoneNumber = String(formData.get("phoneNumber") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  setBusy(smsForm, true);
  smsResult.textContent = "Sending...";

  try {
    const sent = await api.sms.send({
      phoneNumber,
      message,
      metadata: {
        source: "builder-frontend"
      }
    });
    const status = await waitForSmsStatus(sent.jobId);
    smsResult.innerHTML = `
      <strong>${sent.deduplicated ? "Deduplicated" : "Queued"}</strong>
      <span>${sent.jobId} · ${status.status} · ${status.provider}</span>
    `;
    await refreshSms();
  } catch (error) {
    smsResult.textContent = errorMessage(error);
  } finally {
    setBusy(smsForm, false);
  }
}

async function waitForSmsStatus(jobId: string): Promise<SmsStatusResponse> {
  let latest = await api.sms.status(jobId);

  for (let attempt = 0; attempt < 8 && latest.status !== "sent" && latest.status !== "failed"; attempt += 1) {
    await delay(500);
    latest = await api.sms.status(jobId);
  }

  return latest;
}

async function refreshSms(): Promise<void> {
  try {
    const messages = await api.sms.recent();
    renderSmsRows(messages);
  } catch (error) {
    smsRecent.innerHTML = `<tr><td colspan="4">${escapeHtml(errorMessage(error))}</td></tr>`;
  }
}

function renderSmsRows(messages: SmsRecentMessageResponse[]): void {
  if (messages.length === 0) {
    smsRecent.innerHTML = `<tr><td colspan="4">No messages yet.</td></tr>`;
    return;
  }

  smsRecent.innerHTML = messages
    .map(
      (message) => `
        <tr>
          <td>
            <button class="link-button" type="button" data-sms-job="${escapeHtml(message.jobId)}">
              ${escapeHtml(shortId(message.jobId))}
            </button>
            <small>${escapeHtml(message.phoneNumber)}</small>
          </td>
          <td><span class="badge ${statusClass(message.status)}">${escapeHtml(message.status)}</span></td>
          <td>${escapeHtml(message.provider)}</td>
          <td>${message.attempts}</td>
        </tr>
      `
    )
    .join("");

  smsRecent.querySelectorAll<HTMLButtonElement>("[data-sms-job]").forEach((button) => {
    button.addEventListener("click", () => {
      const jobId = button.dataset.smsJob;

      if (jobId) {
        void showSmsStatus(jobId);
      }
    });
  });
}

async function showSmsStatus(jobId: string): Promise<void> {
  try {
    const status = await api.sms.status(jobId);
    smsResult.innerHTML = `
      <strong>${escapeHtml(status.jobId)}</strong>
      <span>${escapeHtml(status.status)} · ${escapeHtml(status.provider)} · attempts ${status.attempts}</span>
    `;
  } catch (error) {
    smsResult.textContent = errorMessage(error);
  }
}

async function uploadReceipt(): Promise<void> {
  const fileInput = receiptForm.elements.namedItem("file");
  const modelInput = receiptForm.elements.namedItem("model");

  if (!(fileInput instanceof HTMLInputElement) || !fileInput.files?.[0]) {
    receiptResult.textContent = "Choose a receipt image first.";
    return;
  }

  if (!(modelInput instanceof HTMLSelectElement)) {
    receiptResult.textContent = "Receipt model selector is missing.";
    return;
  }

  const file = fileInput.files[0];
  const model = modelInput.value as ReceiptRecognitionModel;

  setBusy(receiptForm, true);
  receiptResult.innerHTML = `<div class="empty">Uploading and recognizing...</div>`;

  try {
    const upload = await api.receipts.upload(file, model);
    const receipt = await api.receipts.get(upload.receiptId);
    const raw = await api.receipts.raw(upload.receiptId);
    renderReceipt(receipt);
    receiptRaw.textContent = raw.rawText || "No OCR text returned.";
    await refreshReceipts();
  } catch (error) {
    receiptResult.innerHTML = `<div class="empty">${escapeHtml(errorMessage(error))}</div>`;
  } finally {
    setBusy(receiptForm, false);
  }
}

async function refreshReceipts(): Promise<void> {
  try {
    const receipts = await api.receipts.recent();
    renderReceiptHistory(receipts);

    if (receipts[0]) {
      renderReceipt(receipts[0]);
    }
  } catch (error) {
    receiptHistory.textContent = errorMessage(error);
  }
}

function renderReceipt(receipt: ReceiptRecognizerReceiptResponse): void {
  receiptResult.innerHTML = `
    ${fieldCard("Amount", receipt.amount === null ? "n/a" : `${receipt.currency ?? "INR"} ${receipt.amount}`)}
    ${fieldCard("Recipient", receipt.recipient ?? "n/a")}
    ${fieldCard("Transaction", receipt.transactionId ?? "n/a")}
    ${fieldCard("UTR", receipt.utr ?? "n/a")}
    ${fieldCard("Model", `${receipt.requestedModel} → ${receipt.recognitionModel}`)}
    ${fieldCard("Confidence", `${Math.round(receipt.confidence * 100)}%`)}
  `;
}

function renderReceiptHistory(receipts: ReceiptRecognizerReceiptResponse[]): void {
  if (receipts.length === 0) {
    receiptHistory.innerHTML = `<div class="empty">No receipts uploaded yet.</div>`;
    return;
  }

  receiptHistory.innerHTML = receipts
    .map(
      (receipt) => `
        <button class="list-item" type="button" data-receipt-id="${escapeHtml(receipt.receiptId)}">
          <span>${escapeHtml(receipt.originalFilename)}</span>
          <strong>${receipt.amount === null ? "n/a" : `${escapeHtml(receipt.currency ?? "INR")} ${receipt.amount}`}</strong>
        </button>
      `
    )
    .join("");

  receiptHistory.querySelectorAll<HTMLButtonElement>("[data-receipt-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const receiptId = button.dataset.receiptId;

      if (receiptId) {
        void loadReceipt(receiptId);
      }
    });
  });
}

async function loadReceipt(receiptId: string): Promise<void> {
  try {
    const [receipt, raw] = await Promise.all([api.receipts.get(receiptId), api.receipts.raw(receiptId)]);
    renderReceipt(receipt);
    receiptRaw.textContent = raw.rawText || "No OCR text returned.";
  } catch (error) {
    receiptRaw.textContent = errorMessage(error);
  }
}

function openAdminModal(): void {
  adminModal.hidden = false;
  adminModalStatus.textContent = layoutState.activeAdminSession
    ? `Signed in as ${layoutState.activeAdminSession.admin.email}`
    : "";
  adminForm.querySelector<HTMLInputElement>('input[name="email"]')?.focus();
}

function closeAdminModal(): void {
  adminModal.hidden = true;
  adminModalStatus.textContent = "";
}

async function loginAdmin(): Promise<void> {
  const formData = new FormData(adminForm);
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  adminModalStatus.textContent = "Signing in...";

  try {
    const session = await api.layout.adminLogin({ email, password });
    layoutState.activeAdminSession = session;
    window.localStorage.setItem("layout-admin-session", session.sessionToken);
    renderAdminSession();
    adminModalStatus.textContent = "Signed in.";
    closeAdminModal();
    if (layoutState.activeBrand) {
      await loadBrandContract(layoutState.activeBrand.brandId);
    }
  } catch (error) {
    adminModalStatus.textContent = errorMessage(error);
  }
}

async function createDevAdminSession(): Promise<void> {
  adminModalStatus.textContent = "Creating dev session...";

  try {
    const session = await api.layout.adminDevSession();
    layoutState.activeAdminSession = session;
    window.localStorage.setItem("layout-admin-session", session.sessionToken);
    renderAdminSession();
    adminModalStatus.textContent = "Dev session ready.";
    closeAdminModal();
    if (layoutState.activeBrand) {
      await loadBrandContract(layoutState.activeBrand.brandId);
    }
  } catch (error) {
    adminModalStatus.textContent = errorMessage(error);
  }
}

function logoutAdmin(): void {
  layoutState.activeAdminSession = null;
  window.localStorage.removeItem("layout-admin-session");
  renderAdminSession();
  adminModalStatus.textContent = "Signed out.";
}

async function refreshBrands(): Promise<void> {
  try {
    const brands = await api.layout.recent();
    recentLayoutBrands = brands;
    renderBrandList(brands);

    if (brands.length === 0) {
      clearLayoutSelection();
      return;
    }

    const activeBrandId = layoutState.activeBrand?.brandId;
    const activeBrandStillExists = activeBrandId
      ? brands.some((brand) => brand.brandId === activeBrandId)
      : false;

    if (!activeBrandStillExists) {
      const preferredBrand = brands.find((brand) => Boolean(brand.generatedArtifact)) ?? brands[0];

      if (preferredBrand) {
        await selectBrand(preferredBrand.brandId);
      }
    }
  } catch (error) {
    brandList.textContent = errorMessage(error);
  }
}

function renderBrandList(brands: LayoutBuilderBrandListItem[]): void {
  if (brands.length === 0) {
    brandList.innerHTML = `<div class="empty">No brands yet.</div>`;
    return;
  }

  brandList.innerHTML = brands
    .map(
      (brand) => `
        <button class="list-item brand-item${layoutState.activeBrand?.brandId === brand.brandId ? " active" : ""}" type="button" data-brand-id="${escapeHtml(brand.brandId)}">
          <span class="swatch" style="background:${escapeHtml(brand.palette.primary)}"></span>
          <span>
            <strong>${escapeHtml(brand.name)}</strong>
            <small>${escapeHtml(shortId(brand.brandId))} · ${brand.generatedArtifact ? "generated gateway" : "legacy runtime"}</small>
          </span>
        </button>
      `
    )
    .join("");

  brandList.querySelectorAll<HTMLButtonElement>("[data-brand-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const brandId = button.dataset.brandId;

      if (brandId) {
        void selectBrand(brandId);
      }
    });
  });
}

async function selectBrand(brandId: string): Promise<void> {
  const brand = recentLayoutBrands.find((item) => item.brandId === brandId);

  if (!brand) {
    livePreview.innerHTML = `<div class="empty">Brand was not found in the recent list: ${escapeHtml(brandId)}</div>`;
    return;
  }

  layoutState.activeBrand = brand;
  layoutState.activeSchema = null;
  layoutState.activeRuntimeContract = null;
  layoutState.activeRuntimeResources = null;
  layoutState.activeRuntimeRequestLogs = [];
  layoutState.activeContractVersions = [];
  layoutState.activeBrandMemberships = [];
  applyBrandPreview(brand);
  renderBrandListSelection(brandId);
  void loadBrandContract(brandId);
}

function applyBrandPreview(
  brand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem,
  brandName?: string
): void {
  selectedBrandTitle.textContent = `${brandName ?? brand.name} · ${brand.brandId}`;
  renderContractInspector(
    brand,
    layoutState.activeSchema,
    layoutState.activeRuntimeContract,
    layoutState.activeRuntimeResources,
    layoutState.activeRuntimeRequestLogs,
    layoutState.activeContractVersions,
    layoutState.activeBrandMemberships
  );
  deleteBrandButton.disabled = false;
  openBrandAppButton.disabled = false;
  openDemoMerchantButton.disabled = !layoutState.activeRuntimeResources?.demoSessionToken;
  resetBrandDemoButton.disabled = false;
  seedBrandDemoButton.disabled = false;
  renderLivePreview(brand);
}

function renderLivePreview(brand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem): void {
  livePreview.removeAttribute("style");
  livePreview.innerHTML = `
    <iframe
      class="preview-frame"
      title="${escapeHtml(brand.name)} live preview"
      src="${escapeHtml(brandUserAppUrlWithSession(brand, layoutState.activeRuntimeResources?.demoSessionToken))}"
    ></iframe>
  `;
}

async function loadBrandContract(brandId: string): Promise<void> {
  const activeBrand = layoutState.activeBrand;

  if (!activeBrand || activeBrand.brandId !== brandId) {
    return;
  }

  renderContractLoading(activeBrand);

  try {
    const schema = await api.layout.schema(brandId);
    const [runtimeContract, runtimeResources, runtimeRequestLogs, contractVersions, brandMemberships] = await Promise.all([
      api.layout.runtimeConfig<BrandRuntimeContract>(schema.endpoint),
      api.layout.runtimeAdminResources<BrandRuntimeResources>(schema.endpoint),
      api.layout.runtimeRequestLogs<BrandRuntimeRequestLog[]>(schema.endpoint),
      api.layout.contractVersions(brandId),
      api.layout.brandMemberships(brandId)
    ]);

    if (layoutState.activeBrand?.brandId !== brandId) {
      return;
    }

    layoutState.activeSchema = schema;
    layoutState.activeRuntimeContract = runtimeContract;
    layoutState.activeRuntimeResources = runtimeResources;
    layoutState.activeRuntimeRequestLogs = runtimeRequestLogs;
    layoutState.activeContractVersions = contractVersions;
    layoutState.activeBrandMemberships = brandMemberships;
    openDemoMerchantButton.disabled = !runtimeResources.demoSessionToken;
    renderLivePreview(activeBrand);
    renderContractInspector(
      activeBrand,
      schema,
      runtimeContract,
      runtimeResources,
      runtimeRequestLogs,
      contractVersions,
      brandMemberships
    );
  } catch (error) {
    contractInspector.innerHTML = `
      <div class="contract-card">
        <strong>Contract unavailable</strong>
        <small>${escapeHtml(errorMessage(error))}</small>
      </div>
    `;
  }
}

function renderBrandListSelection(brandId: string): void {
  brandList.querySelectorAll<HTMLButtonElement>("[data-brand-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.brandId === brandId);
  });
}

function clearLayoutSelection(): void {
  layoutState.activeBrand = null;
  layoutState.activeSchema = null;
  layoutState.activeRuntimeContract = null;
  layoutState.activeRuntimeResources = null;
  layoutState.activeRuntimeRequestLogs = [];
  layoutState.activeContractVersions = [];
  layoutState.activeBrandMemberships = [];
  selectedBrandTitle.textContent = "No brand selected";
  contractInspector.innerHTML = "";
  deleteBrandButton.disabled = true;
  openBrandAppButton.disabled = true;
  openDemoMerchantButton.disabled = true;
  resetBrandDemoButton.disabled = true;
  seedBrandDemoButton.disabled = true;
  livePreview.removeAttribute("style");
  livePreview.innerHTML = `<div class="empty">Select a brand to load the preview.</div>`;
}

function renderContractLoading(brand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem): void {
  const profile = brand.generationProfile;

  if (!profile) {
    contractInspector.innerHTML = `<span>deterministic layout contract</span>`;
    return;
  }

  contractInspector.innerHTML = `
    <div class="contract-card">
      <span>${escapeHtml(profile.provider)} · ${escapeHtml(profile.model)}</span>
      <strong>${escapeHtml(profile.resourceAlias)}</strong>
      <small>Loading runtime contract...</small>
    </div>
  `;
}

function renderContractInspector(
  brand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem,
  schema: LayoutBuilderBrandSchemaResponse | null,
  runtimeContract: BrandRuntimeContract | null,
  runtimeResources: BrandRuntimeResources | null,
  runtimeRequestLogs: BrandRuntimeRequestLog[] = [],
  contractVersions: LayoutBuilderContractVersionRecord[] = [],
  brandMemberships: LayoutBuilderBrandMembership[] = []
): void {
  const profile = schema?.generationProfile ?? brand.generationProfile;

  if (!profile || !schema || !runtimeContract) {
    renderContractLoading(brand);
    return;
  }

  contractInspector.innerHTML = `
    <div class="contract-card">
      <span>${escapeHtml(profile.provider)} · ${escapeHtml(profile.model)}</span>
      <strong>${escapeHtml(runtimeContract.resourceAlias)}</strong>
      <small>${escapeHtml(profile.contractSummary)}</small>
    </div>
    ${
      schema.generatedArtifact
        ? generatedArtifactHtml(schema.generatedArtifact, schema.contractVersion, contractVersions, profile)
        : ""
    }
    <div class="contract-grid">
      <div class="contract-card">
        <h4>Endpoints</h4>
        ${endpointRows(schema, runtimeContract)}
      </div>
      <div class="contract-card">
        <h4>Payment fields</h4>
        ${mappingRows(runtimeContract.fields)}
      </div>
      <div class="contract-card">
        <h4>Customer fields</h4>
        ${mappingRows(runtimeContract.customerFields)}
      </div>
      <div class="contract-card">
        <h4>Payment method fields</h4>
        ${mappingRows(runtimeContract.paymentMethodFields)}
      </div>
      <div class="contract-card">
        <h4>Balance fields</h4>
        ${mappingRows(runtimeContract.balanceFields)}
      </div>
      <div class="contract-card">
        <h4>Status map</h4>
        ${mappingRows(runtimeContract.statusMap)}
      </div>
      <div class="contract-card">
        <h4>Actions</h4>
        ${mappingRows(runtimeContract.actionLabels)}
      </div>
      <div class="contract-card">
        <h4>Auth fields</h4>
        ${mappingRows(runtimeContract.authFields)}
      </div>
    </div>
    ${runtimeResources ? runtimeResourcesHtml(runtimeContract, runtimeResources, runtimeRequestLogs, brandMemberships) : ""}
    ${profile.clarificationAnswers ? clarificationAnswersHtml(profile.clarificationAnswers) : ""}
    <details class="contract-json">
      <summary>System prompt</summary>
      <pre>${escapeHtml(profile.systemPrompt)}</pre>
    </details>
    <details class="contract-json">
      <summary>Runtime contract JSON</summary>
      <pre>${escapeHtml(JSON.stringify(runtimeContract, null, 2))}</pre>
    </details>
  `;
}

function clarificationAnswersHtml(answers: LayoutBuilderClarificationAnswers): string {
  const rows = Object.entries(answers)
    .map(([key, value]) => {
      const label = key.replaceAll("_", " ");
      const rendered = Array.isArray(value) ? value.join(", ") : value;

      return `
        <div class="contract-row">
          <span>${escapeHtml(label)}</span>
          <code>${escapeHtml(rendered)}</code>
        </div>
      `;
    })
    .join("");

  return `
    <details class="contract-json">
      <summary>Clarification answers</summary>
      ${rows}
    </details>
  `;
}

function generatedArtifactHtml(
  artifact: NonNullable<LayoutBuilderBrandSchemaResponse["generatedArtifact"]>,
  contractVersion: LayoutBuilderBrandSchemaResponse["contractVersion"],
  contractVersions: LayoutBuilderContractVersionRecord[],
  profile: NonNullable<LayoutBuilderBrandSchemaResponse["generationProfile"]>
): string {
  return `
    <div class="contract-card artifact-card">
      <h4>Generated frontend artifact</h4>
      <div class="contract-grid compact">
        ${contractMetric("files", artifact.files.length)}
        ${contractMetric("routes", artifact.routes.length)}
        ${contractMetric("capabilities", artifact.capabilities.length)}
      </div>
      <a class="button secondary artifact-link" href="${escapeHtml(api.layout.publicUrl(`${artifact.facadeBasePath}/generated/preview`))}" target="_blank" rel="noreferrer">Open generated preview</a>
      <details class="contract-json regeneration-panel">
        <summary>Regenerate with prompt</summary>
        <label>
          Brand brief
          <textarea id="contract-regenerate-brief" rows="5">${escapeHtml(profile.adminPrompt)}</textarea>
        </label>
        <label>
          System prompt
          <textarea id="contract-regenerate-system-prompt" rows="7">${escapeHtml(profile.systemPrompt)}</textarea>
        </label>
        <button class="button secondary artifact-link" type="button" data-regenerate-contract>Create new version</button>
      </details>
      <details class="contract-json artifact-details">
        <summary>Artifact details</summary>
        <div class="contract-row">
          <span>artifact</span>
          <code>${escapeHtml(artifact.artifactId)}</code>
        </div>
        <div class="contract-row">
          <span>contract version</span>
          <code>${escapeHtml(contractVersion?.contractVersionId ?? artifact.contractVersionId)}</code>
        </div>
        <div class="contract-row">
          <span>contract status</span>
          <code>${contractVersion?.active ? "active" : "legacy manifest"}</code>
        </div>
        <div class="contract-row">
          <span>entry</span>
          <code>${escapeHtml(artifact.entryFile)}</code>
        </div>
        <div class="contract-row">
          <span>BFF base</span>
          <code>${escapeHtml(artifact.facadeBasePath)}</code>
        </div>
        <div class="artifact-files">
          ${artifact.files.map((file) => `<code>${escapeHtml(file.path)} · ${file.kind} · ${file.bytes}b</code>`).join("")}
        </div>
      </details>
      ${contractVersionHistoryHtml(contractVersion?.contractVersionId ?? artifact.contractVersionId, contractVersions)}
      <details class="contract-json">
        <summary>Artifact manifest</summary>
        <pre>${escapeHtml(JSON.stringify(artifact, null, 2))}</pre>
      </details>
    </div>
  `;
}

function contractVersionHistoryHtml(activeContractVersionId: string, versions: LayoutBuilderContractVersionRecord[]): string {
  if (versions.length === 0) {
    return "";
  }

  return `
    <details class="contract-json version-history">
      <summary>Contract versions</summary>
      <div class="version-list">
        ${versions
          .map((record) => {
            const version = record.contractVersion;
            const isActive = version.contractVersionId === activeContractVersionId || version.active;

            return `
              <div class="version-row">
                <code>${escapeHtml(version.contractVersionId)}</code>
                <span>${escapeHtml(version.resourceAlias)} · ${escapeHtml(new Date(version.createdAt).toLocaleString())}</span>
                ${
                  isActive
                    ? `<strong>active</strong>`
                    : `<button class="button secondary" type="button" data-activate-contract-version="${escapeHtml(version.contractVersionId)}">Activate</button>`
                }
              </div>
            `;
          })
          .join("")}
      </div>
    </details>
  `;
}

function runtimeResourcesHtml(
  runtimeContract: BrandRuntimeContract,
  resources: BrandRuntimeResources,
  requestLogs: BrandRuntimeRequestLog[],
  brandMemberships: LayoutBuilderBrandMembership[]
): string {
  const recentPayments = resources.payments.slice(0, 5);
  const recentCustomers = resources.customers.slice(0, 5);

  return `
    <div class="contract-card">
      <h4>Live payment core data</h4>
      <div class="contract-grid compact">
        ${contractMetric("merchants", resources.users.length)}
        ${contractMetric("accounts", resources.accounts.length)}
        ${contractMetric(runtimeContract.resourceAlias, resources.payments.length)}
        ${contractMetric("customers", resources.customers.length)}
        ${contractMetric("methods", resources.paymentMethods.length)}
        ${contractMetric("intents", resources.paymentIntents.length)}
        ${contractMetric("balances", resources.balanceTransactions.length)}
      </div>
      ${
        recentPayments.length > 0
          ? `<div class="mini-table">${recentPayments
              .map((payment) => {
                const reference = stringCell(payment[runtimeContract.fields.externalReference ?? "externalReference"]);
                const status = stringCell(payment[runtimeContract.fields.status ?? "status"]);
                const amount = stringCell(payment[runtimeContract.fields.amount ?? "amount"]);
                const currency = stringCell(payment[runtimeContract.fields.currency ?? "currency"]);

                return `<div><strong>${escapeHtml(reference)}</strong><span>${escapeHtml(status)}</span><code>${escapeHtml(`${amount} ${currency}`)}</code></div>`;
              })
              .join("")}</div>`
          : `<small>No live payments for this brand yet.</small>`
      }
      ${
        recentCustomers.length > 0
          ? `<details class="contract-json"><summary>Recent customers</summary><pre>${escapeHtml(JSON.stringify(recentCustomers, null, 2))}</pre></details>`
          : ""
      }
      ${brandMembershipsHtml(brandMemberships)}
      ${requestLogsHtml(requestLogs)}
    </div>
  `;
}

function brandMembershipsHtml(memberships: LayoutBuilderBrandMembership[]): string {
  if (memberships.length === 0) {
    return `<small>No shared auth memberships have been recorded for this brand yet.</small>`;
  }

  return `
    <details class="contract-json" open>
      <summary>Shared auth memberships</summary>
      <div class="mini-table request-log-table">
        ${memberships
          .slice(0, 8)
          .map((membership) => {
            const label = membership.merchantEmail ?? membership.adminId ?? membership.subjectKey;
            const source = `${membership.subjectType} · ${membership.role} · ${membership.source}`;

            return `
              <div>
                <strong>${escapeHtml(label)}</strong>
                <span>${escapeHtml(source)}</span>
                <code>${escapeHtml(membership.merchantAccountId ?? membership.membershipId)}</code>
              </div>
            `;
          })
          .join("")}
      </div>
    </details>
  `;
}

function requestLogsHtml(requestLogs: BrandRuntimeRequestLog[]): string {
  if (requestLogs.length === 0) {
    return `<small>No BFF requests have been logged for this brand yet.</small>`;
  }

  return `
    <details class="contract-json" open>
      <summary>BFF request log</summary>
      <div class="mini-table request-log-table">
        ${requestLogs
          .slice(0, 8)
          .map(
            (log) => `
              <div>
                <strong>${escapeHtml(`${log.method} ${log.alias}`)}</strong>
                <span>${escapeHtml(`${log.operation} · ${log.status} · ${log.durationMs}ms`)}</span>
                <code>${escapeHtml(log.errorMessage ?? new Date(log.createdAt).toLocaleTimeString())}</code>
              </div>
            `
          )
          .join("")}
      </div>
    </details>
  `;
}

function contractMetric(label: string, value: number): string {
  return `
    <div class="contract-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function endpointRows(
  schema: LayoutBuilderBrandSchemaResponse,
  runtimeContract: BrandRuntimeContract
): string {
  const rows: Array<[string, string]> = [
    ["app", api.layout.brandRuntimeUrl(schema.appUrl)],
    ...(schema.generatedPreviewUrl ? [["generated preview", api.layout.publicUrl(schema.generatedPreviewUrl)] as [string, string]] : []),
    ["config", runtimeEndpoint(schema.endpoint, runtimeContract, "config")],
    ["register", runtimeEndpoint(schema.endpoint, runtimeContract, "register")],
    ["login", runtimeEndpoint(schema.endpoint, runtimeContract, "login")],
    ["payments", runtimeEndpoint(schema.endpoint, runtimeContract, "payments")],
    ["customers", runtimeEndpoint(schema.endpoint, runtimeContract, "customers")],
    ["payment methods", runtimeEndpoint(schema.endpoint, runtimeContract, "paymentMethods")],
    ["payment intents", runtimeEndpoint(schema.endpoint, runtimeContract, "paymentIntents")],
    ["balance transactions", runtimeEndpoint(schema.endpoint, runtimeContract, "balanceTransactions")],
    ["admin resources", `${schema.endpoint}/runtime/admin/resources`],
    ["seed demo data", `${schema.endpoint}/runtime/admin/seed`],
    ["reset demo data", `${schema.endpoint}/runtime/admin/reset-demo`],
    ["request logs", `${schema.endpoint}/runtime/admin/request-logs`]
  ];

  return rows.map(([label, value]) => contractRow(label, value)).join("");
}

function runtimeEndpoint(baseEndpoint: string, contract: BrandRuntimeContract, key: string): string {
  return `${baseEndpoint}/${contract.endpoints[key] ?? key}`;
}

function mappingRows(mapping: Record<string, string>): string {
  return Object.entries(mapping)
    .map(([label, value]) => contractRow(label, value))
    .join("");
}

function contractRow(label: string, value: string): string {
  return `
    <div class="contract-row">
      <span>${escapeHtml(label)}</span>
      <code>${escapeHtml(value)}</code>
    </div>
  `;
}

function stringCell(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

async function deleteActiveBrand(): Promise<void> {
  const brand = layoutState.activeBrand;

  if (!brand) {
    return;
  }

  if (!window.confirm(`Delete brand ${brand.brandId}?`)) {
    return;
  }

  deleteBrandButton.disabled = true;

  try {
    await api.layout.deleteBrand(brand.brandId);
    clearLayoutSelection();
    await refreshBrands();
  } catch (error) {
    deleteBrandButton.disabled = false;
    livePreview.innerHTML = `<div class="empty">${escapeHtml(errorMessage(error))}</div>`;
  }
}

async function regenerateActiveContractVersion(): Promise<void> {
  const brand = layoutState.activeBrand;

  if (!brand) {
    return;
  }

  contractInspector.innerHTML = `
    <div class="contract-card">
      <strong>Regenerating contract version...</strong>
      <small>${escapeHtml(brand.brandId)}</small>
    </div>
  `;

  try {
    const aiPrompt = textAreaValue("contract-regenerate-brief");
    const systemPrompt = textAreaValue("contract-regenerate-system-prompt");
    await api.layout.regenerateContractVersion(brand.brandId, {
      ...(aiPrompt ? { aiPrompt } : {}),
      ...(systemPrompt ? { systemPrompt } : {})
    });
    await reloadActiveBrandAfterVersionChange(brand.brandId);
  } catch (error) {
    contractInspector.innerHTML = `
      <div class="contract-card">
        <strong>Regeneration failed</strong>
        <small>${escapeHtml(errorMessage(error))}</small>
      </div>
    `;
  }
}

function textAreaValue(id: string): string | undefined {
  const element = document.getElementById(id);

  if (!(element instanceof HTMLTextAreaElement)) {
    return undefined;
  }

  const value = element.value.trim();

  return value.length > 0 ? value : undefined;
}

async function activateContractVersion(contractVersionId: string): Promise<void> {
  const brand = layoutState.activeBrand;

  if (!brand || !window.confirm(`Activate contract version ${contractVersionId}?`)) {
    return;
  }

  contractInspector.innerHTML = `
    <div class="contract-card">
      <strong>Activating contract version...</strong>
      <small>${escapeHtml(contractVersionId)}</small>
    </div>
  `;

  try {
    await api.layout.activateContractVersion(brand.brandId, contractVersionId);
    await reloadActiveBrandAfterVersionChange(brand.brandId);
  } catch (error) {
    contractInspector.innerHTML = `
      <div class="contract-card">
        <strong>Activation failed</strong>
        <small>${escapeHtml(errorMessage(error))}</small>
      </div>
    `;
  }
}

async function reloadActiveBrandAfterVersionChange(brandId: string): Promise<void> {
  await refreshBrands();
  const refreshedBrand = recentLayoutBrands.find((brand) => brand.brandId === brandId);

  if (refreshedBrand) {
    layoutState.activeBrand = refreshedBrand;
    applyBrandPreview(refreshedBrand);
  }

  await loadBrandContract(brandId);
}

async function seedActiveBrandDemoData(): Promise<void> {
  const schema = layoutState.activeSchema;
  const brand = layoutState.activeBrand;

  if (!schema || !brand) {
    return;
  }

  seedBrandDemoButton.disabled = true;
  seedBrandDemoButton.textContent = "Seeding...";

  try {
    const runtimeResources = await api.layout.seedRuntimeDemoData<BrandRuntimeResources>(schema.endpoint);
    const brandMemberships = await api.layout.brandMemberships(brand.brandId);
    layoutState.activeRuntimeResources = runtimeResources;
    layoutState.activeBrandMemberships = brandMemberships;
    openDemoMerchantButton.disabled = !runtimeResources.demoSessionToken;
    renderContractInspector(
      brand,
      schema,
      layoutState.activeRuntimeContract,
      runtimeResources,
      layoutState.activeRuntimeRequestLogs,
      layoutState.activeContractVersions,
      brandMemberships
    );
  } catch (error) {
    livePreview.innerHTML = `<div class="empty">${escapeHtml(errorMessage(error))}</div>`;
  } finally {
    seedBrandDemoButton.disabled = false;
    seedBrandDemoButton.textContent = "Seed demo data";
  }
}

async function resetActiveBrandDemoData(): Promise<void> {
  const schema = layoutState.activeSchema;
  const brand = layoutState.activeBrand;

  if (!schema || !brand || !window.confirm("Reset demo data for this brand?")) {
    return;
  }

  resetBrandDemoButton.disabled = true;
  resetBrandDemoButton.textContent = "Resetting...";

  try {
    const runtimeResources = await api.layout.resetRuntimeDemoData<BrandRuntimeResources>(schema.endpoint);
    const brandMemberships = await api.layout.brandMemberships(brand.brandId);
    layoutState.activeRuntimeResources = runtimeResources;
    layoutState.activeBrandMemberships = brandMemberships;
    openDemoMerchantButton.disabled = true;
    renderContractInspector(
      brand,
      schema,
      layoutState.activeRuntimeContract,
      runtimeResources,
      layoutState.activeRuntimeRequestLogs,
      layoutState.activeContractVersions,
      brandMemberships
    );
  } catch (error) {
    livePreview.innerHTML = `<div class="empty">${escapeHtml(errorMessage(error))}</div>`;
  } finally {
    resetBrandDemoButton.disabled = false;
    resetBrandDemoButton.textContent = "Reset demo data";
  }
}

function openActiveBrandAsDemoMerchant(): void {
  const brand = layoutState.activeBrand;
  const sessionToken = layoutState.activeRuntimeResources?.demoSessionToken;

  if (!brand || !sessionToken) {
    return;
  }

  const url = new URL(brandUserAppUrl(brand), window.location.origin);
  url.searchParams.set("sessionToken", sessionToken);
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

function brandUserAppUrlWithSession(
  brand: Pick<LayoutBuilderBrandListItem, "appUrl" | "generatedPreviewUrl">,
  sessionToken: string | undefined
): string {
  const url = new URL(brandUserAppUrl(brand), window.location.origin);

  if (sessionToken) {
    url.searchParams.set("sessionToken", sessionToken);
  }

  return url.toString();
}

function brandUserAppUrl(brand: Pick<LayoutBuilderBrandListItem, "appUrl" | "generatedPreviewUrl">): string {
  return api.layout.brandRuntimeUrl(brand.appUrl);
}

function fieldCard(label: string, value: string): string {
  return `
    <div class="field-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function setBusy(form: HTMLFormElement, busy: boolean): void {
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>(
    "input, textarea, select, button"
  ).forEach((element) => {
    element.disabled = busy;
  });
}

function statusClass(status: string): string {
  switch (status) {
    case "sent":
    case "paid":
      return "ok";
    case "failed":
      return "bad";
    case "processing":
    case "queued":
    case "pending":
      return "warn";
    default:
      return "muted";
  }
}

function shortId(value: string): string {
  return value.length > 14 ? `${value.slice(0, 10)}...` : value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      default:
        return "&#039;";
    }
  });
}
