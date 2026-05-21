import type {
  HealthResponse,
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  ReceiptRecognitionModel,
  ReceiptRecognizerReceiptResponse
} from "@payment-ops/shared-types";

import { api, type SmsRecentMessageResponse, type SmsStatusResponse } from "./api.js";
import { createDemoLogo } from "./demo-data.js";
import "./styles.css";

interface LayoutState {
  activeBrand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem | null;
  activeSchema: LayoutBuilderBrandSchemaResponse | null;
  activeRuntimeContract: BrandRuntimeContract | null;
}

interface BrandRuntimeContract {
  brandId: string;
  brandName: string;
  resourceAlias: string;
  statusMap: Record<string, string>;
  actionLabels: Record<string, string>;
  fields: Record<string, string>;
  accountFields: Record<string, string>;
  userFields: Record<string, string>;
  authFields: Record<string, string>;
  endpoints: Record<string, string>;
}

type DemoRoute = "sms" | "receipts" | "layouts";

const ROUTES: readonly DemoRoute[] = ["sms", "receipts", "layouts"];

const layoutState: LayoutState = {
  activeBrand: null,
  activeSchema: null,
  activeRuntimeContract: null
};
let recentLayoutBrands: LayoutBuilderBrandListItem[] = [];

const app = document.querySelector<HTMLDivElement>("#app");
const DEFAULT_BRAND_SYSTEM_PROMPT = [
  "Generate a brand runtime contract for a payment platform.",
  "The generated brand must integrate only through the public brand runtime API.",
  "Do not expose internal payment-core DTO names, database tables, service names, or shared backend details.",
  "Return distinct resource naming, payment status labels, action labels, and visual direction.",
  "The user-facing interface must support registration, login, payment creation, refunds, and transaction history."
].join("\n");

if (!app) {
  throw new Error("Missing #app root");
}

app.innerHTML = `
  <header class="topbar">
    <div>
      <p class="eyebrow">Payment Ops Prototype</p>
      <h1>Local demo console</h1>
    </div>
    <button class="button secondary" id="refresh-all" type="button">Refresh</button>
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
        <article class="status-card inline-status" id="health-layout">
          <span class="status-dot muted"></span>
          <div>
            <strong>Layout Builder</strong>
            <span>Checking</span>
          </div>
        </article>
        <div class="panel-header">
          <div>
            <h2>Brand layout demo</h2>
          </div>
        </div>
        <div class="layout-workbench">
          <aside class="brand-sidebar">
            <div class="sidebar-header">
              <h3>Brands</h3>
              <div class="sidebar-actions">
                <button class="icon-button" id="open-brand-modal" type="button" title="Create brand">+</button>
                <button class="icon-button" id="layout-refresh" type="button" title="Refresh brands">↻</button>
              </div>
            </div>
            <div class="list compact" id="brand-list"></div>
            <button class="button danger sidebar-delete" id="delete-brand" type="button" disabled>Delete selected</button>
          </aside>

          <section class="preview-column">
            <div class="preview-header">
              <div>
                <h3>Live SPA preview</h3>
                <div class="selected-brand" id="selected-brand-title">No brand selected</div>
                <div class="contract-inspector" id="contract-inspector"></div>
              </div>
              <button class="button secondary" id="open-brand-app" type="button" disabled>Open user app</button>
            </div>
            <div class="live-preview" id="live-preview">
              <div class="empty">Select a brand to load the preview.</div>
            </div>
          </section>

        </div>
      </article>
    </section>
  </main>

  <div class="modal-backdrop" id="brand-modal" hidden>
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="brand-modal-title">
      <div class="modal-header">
        <h3 id="brand-modal-title">Create brand</h3>
        <button class="icon-button" id="close-brand-modal" type="button" aria-label="Close create brand dialog">X</button>
      </div>
      <form id="brand-form" class="form-grid">
        <label>
          Brand name
          <input name="brandName" value="Nova Ledger" required />
        </label>
        <label>
          AI brand brief
          <textarea name="aiPrompt" rows="5" required>Create a premium treasury payment portal for enterprise merchants. Use settlement-focused wording, compact history tables, and status names that do not look like a generic payment processor.</textarea>
        </label>
        <details class="prompt-details" open>
          <summary>System prompt</summary>
          <textarea name="systemPrompt" rows="7" required>${escapeHtml(DEFAULT_BRAND_SYSTEM_PROMPT)}</textarea>
        </details>
        <label>
          Provider
          <select name="aiProvider">
            <option value="local">local runtime generator</option>
            <option value="openai" disabled>OpenAI adapter placeholder</option>
            <option value="gemini" disabled>Gemini adapter placeholder</option>
            <option value="anthropic" disabled>Claude adapter placeholder</option>
          </select>
        </label>
        <label>
          Logo
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
        </label>
        <button class="button" type="submit">Generate brand</button>
        <span class="hint">No file selected uses a generated SVG mark.</span>
        <span class="modal-status" id="brand-modal-status"></span>
      </form>
    </section>
  </div>
`;

const refreshAllButton = required<HTMLButtonElement>("#refresh-all");
const smsForm = required<HTMLFormElement>("#sms-form");
const smsResult = required<HTMLElement>("#sms-result");
const smsRecent = required<HTMLElement>("#sms-recent");
const receiptForm = required<HTMLFormElement>("#receipt-form");
const receiptResult = required<HTMLElement>("#receipt-result");
const receiptRaw = required<HTMLPreElement>("#receipt-raw");
const receiptHistory = required<HTMLElement>("#receipt-history");
const brandForm = required<HTMLFormElement>("#brand-form");
const brandModal = required<HTMLElement>("#brand-modal");
const brandModalStatus = required<HTMLElement>("#brand-modal-status");
const brandList = required<HTMLElement>("#brand-list");
const selectedBrandTitle = required<HTMLElement>("#selected-brand-title");
const contractInspector = required<HTMLElement>("#contract-inspector");
const openBrandAppButton = required<HTMLButtonElement>("#open-brand-app");
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

brandModal.addEventListener("click", (event) => {
  if (event.target === brandModal) {
    closeBrandModal();
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

brandForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void createBrand();
});

deleteBrandButton.addEventListener("click", () => {
  void deleteActiveBrand();
});

openBrandAppButton.addEventListener("click", () => {
  const appUrl = layoutState.activeBrand?.appUrl;

  if (appUrl) {
    window.open(api.layout.brandRuntimeUrl(appUrl), "_blank", "noopener,noreferrer");
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

async function refreshAll(): Promise<void> {
  await Promise.allSettled([refreshHealth(), refreshSms(), refreshReceipts(), refreshBrands()]);
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

  await Promise.allSettled([paintHealth("health-layout", api.health.layout()), refreshBrands()]);
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

function openBrandModal(): void {
  brandModal.hidden = false;
  brandModalStatus.textContent = "";
  brandForm.querySelector<HTMLInputElement>('input[name="brandName"]')?.focus();
}

function closeBrandModal(): void {
  brandModal.hidden = true;
  brandModalStatus.textContent = "";
}

async function createBrand(): Promise<void> {
  const formData = new FormData(brandForm);
  const brandName = String(formData.get("brandName") ?? "").trim();
  const aiPrompt = String(formData.get("aiPrompt") ?? "").trim();
  const systemPrompt = String(formData.get("systemPrompt") ?? "").trim();
  const logoInput = brandForm.elements.namedItem("logo");
  const selectedLogo =
    logoInput instanceof HTMLInputElement && logoInput.files?.[0] ? logoInput.files[0] : null;
  const logo = selectedLogo ?? createDemoLogo(brandName);

  setBusy(brandForm, true);
  brandModalStatus.textContent = "Generating brand runtime...";

  try {
    const brand = aiPrompt
      ? await api.layout.createAiBrand({
          brandName,
          logo,
          aiPrompt,
          systemPrompt: systemPrompt || DEFAULT_BRAND_SYSTEM_PROMPT
        })
      : await api.layout.createBrand(brandName, logo);
    await setActiveBrand(brand);
    await refreshBrands();
    closeBrandModal();
  } catch (error) {
    brandModalStatus.textContent = errorMessage(error);
  } finally {
    setBusy(brandForm, false);
  }
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

    if (!activeBrandStillExists && brands[0]) {
      await selectBrand(brands[0].brandId);
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
            <small>${escapeHtml(shortId(brand.brandId))}</small>
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
  applyBrandPreview(brand);
  renderBrandListSelection(brandId);
  void loadBrandContract(brandId);
}

async function setActiveBrand(brand: LayoutBuilderBrandResponse): Promise<void> {
  layoutState.activeBrand = brand;
  layoutState.activeSchema = brand;
  layoutState.activeRuntimeContract = null;
  applyBrandPreview(brand, brand.name);
  renderBrandListSelection(brand.brandId);
  void loadBrandContract(brand.brandId);
}

function applyBrandPreview(
  brand: LayoutBuilderBrandResponse | LayoutBuilderBrandListItem,
  brandName?: string
): void {
  selectedBrandTitle.textContent = `${brandName ?? brand.name} · ${brand.brandId}`;
  renderContractInspector(brand, layoutState.activeSchema, layoutState.activeRuntimeContract);
  deleteBrandButton.disabled = false;
  openBrandAppButton.disabled = false;
  livePreview.removeAttribute("style");
  livePreview.innerHTML = `
    <iframe
      class="preview-frame"
      title="${escapeHtml(brand.name)} live preview"
      src="${escapeHtml(api.layout.brandRuntimeUrl(brand.appUrl))}"
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
    const runtimeContract = await api.layout.runtimeConfig<BrandRuntimeContract>(schema.endpoint);

    if (layoutState.activeBrand?.brandId !== brandId) {
      return;
    }

    layoutState.activeSchema = schema;
    layoutState.activeRuntimeContract = runtimeContract;
    renderContractInspector(activeBrand, schema, runtimeContract);
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
  selectedBrandTitle.textContent = "No brand selected";
  contractInspector.innerHTML = "";
  deleteBrandButton.disabled = true;
  openBrandAppButton.disabled = true;
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
  runtimeContract: BrandRuntimeContract | null
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

function endpointRows(
  schema: LayoutBuilderBrandSchemaResponse,
  runtimeContract: BrandRuntimeContract
): string {
  const rows: Array<[string, string]> = [
    ["app", api.layout.brandRuntimeUrl(schema.appUrl)],
    ["config", runtimeEndpoint(schema.endpoint, runtimeContract, "config")],
    ["register", runtimeEndpoint(schema.endpoint, runtimeContract, "register")],
    ["login", runtimeEndpoint(schema.endpoint, runtimeContract, "login")],
    ["payments", runtimeEndpoint(schema.endpoint, runtimeContract, "payments")]
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
