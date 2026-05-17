import type {
  HealthResponse,
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  ReceiptRecognitionModel,
  ReceiptRecognizerReceiptResponse
} from "@payment-ops/shared-types";

import { api, type SmsRecentMessageResponse, type SmsStatusResponse } from "./api.js";
import { createDemoLogo, formatJson, parseJson } from "./demo-data.js";
import "./styles.css";

interface LayoutState {
  activeBrand: LayoutBuilderBrandResponse | null;
  activeSchema: LayoutBuilderBrandSchemaResponse | null;
}

type DemoRoute = "sms" | "receipts" | "layouts";
type ContractMethod = "GET" | "POST";

const ROUTES: readonly DemoRoute[] = ["sms", "receipts", "layouts"];

const layoutState: LayoutState = {
  activeBrand: null,
  activeSchema: null
};
let activeContractMethod: ContractMethod = "GET";

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
            <p class="eyebrow">Phase 4 + 5</p>
            <h2>Brand layout demo</h2>
          </div>
          <button class="icon-button" id="layout-refresh" type="button" title="Refresh brands">↻</button>
        </div>
        <div class="layout-workbench">
          <aside class="brand-sidebar">
            <h3>Create brand</h3>
            <form id="brand-form" class="form-grid">
              <label>
                Brand name
                <input name="brandName" value="KOI Demo" required />
              </label>
              <label>
                Logo
                <input name="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" />
              </label>
              <button class="button" type="submit">Create brand</button>
              <span class="hint">No file selected uses a generated SVG mark.</span>
            </form>
            <h3 class="sidebar-title">Recent brands</h3>
            <div class="list compact" id="brand-list"></div>
          </aside>

          <section class="preview-column">
            <div class="preview-header">
              <div>
                <h3>Preview</h3>
                <div class="selected-brand" id="selected-brand-title">No brand selected</div>
              </div>
              <button class="button danger" id="delete-brand" type="button" disabled>Delete brand</button>
            </div>
            <div class="layout-preview">
              <img id="layout-image" alt="Rendered payment operations layout" />
            </div>
          </section>

          <section class="contract-console">
            <div>
              <h3>Brand API contract</h3>
              <div class="schema-meta" id="schema-meta">Create or select a brand to load its schema.</div>
            </div>
            <div class="contract-grid">
              <div>
                <div class="contract-toolbar" aria-label="Contract method">
                  <button class="method-button active" type="button" data-contract-method="GET">GET</button>
                  <button class="method-button" type="button" data-contract-method="POST">POST</button>
                </div>
                <label class="contract-url">
                  Endpoint
                  <input id="contract-endpoint" readonly />
                </label>
                <label id="contract-body-wrap">
                  Request body
                  <textarea id="layout-payload" class="code-input" rows="12" spellcheck="false"></textarea>
                </label>
                <button class="button" id="send-contract" type="button">Send GET</button>
              </div>
              <div>
                <h3 class="response-title">Response</h3>
                <pre id="contract-response">No contract request sent yet.</pre>
              </div>
            </div>
          </section>
        </div>
      </article>
    </section>
  </main>
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
const brandList = required<HTMLElement>("#brand-list");
const selectedBrandTitle = required<HTMLElement>("#selected-brand-title");
const deleteBrandButton = required<HTMLButtonElement>("#delete-brand");
const schemaMeta = required<HTMLElement>("#schema-meta");
const contractEndpoint = required<HTMLInputElement>("#contract-endpoint");
const contractBodyWrap = required<HTMLElement>("#contract-body-wrap");
const layoutPayload = required<HTMLTextAreaElement>("#layout-payload");
const sendContract = required<HTMLButtonElement>("#send-contract");
const contractResponse = required<HTMLPreElement>("#contract-response");
const layoutImage = required<HTMLImageElement>("#layout-image");

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

document.querySelectorAll<HTMLButtonElement>("[data-contract-method]").forEach((button) => {
  button.addEventListener("click", () => {
    const method = button.dataset.contractMethod;

    if (method === "GET" || method === "POST") {
      setContractMethod(method);
    }
  });
});

sendContract.addEventListener("click", () => {
  void sendContractRequest();
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

async function createBrand(): Promise<void> {
  const formData = new FormData(brandForm);
  const brandName = String(formData.get("brandName") ?? "").trim();
  const logoInput = brandForm.elements.namedItem("logo");
  const selectedLogo =
    logoInput instanceof HTMLInputElement && logoInput.files?.[0] ? logoInput.files[0] : null;
  const logo = selectedLogo ?? createDemoLogo(brandName);

  setBusy(brandForm, true);
  schemaMeta.textContent = "Creating brand and schema...";

  try {
    const brand = await api.layout.createBrand(brandName, logo);
    await setActiveBrand(brand);
    await refreshBrands();
  } catch (error) {
    schemaMeta.textContent = errorMessage(error);
  } finally {
    setBusy(brandForm, false);
  }
}

async function refreshBrands(): Promise<void> {
  try {
    const brands = await api.layout.recent();
    renderBrandList(brands);

    if (brands.length === 0) {
      clearLayoutSelection();
      return;
    }

    const activeBrandId = layoutState.activeSchema?.brandId;
    const activeBrandStillExists = activeBrandId
      ? brands.some((brand) => brand.brandId === activeBrandId)
      : false;

    if (!activeBrandStillExists && brands[0]) {
      await selectBrand(brands[0].brandId, brands[0].name);
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
        <button class="list-item brand-item${layoutState.activeSchema?.brandId === brand.brandId ? " active" : ""}" type="button" data-brand-id="${escapeHtml(brand.brandId)}" data-brand-name="${escapeHtml(brand.name)}">
          <span class="swatch" style="background:${escapeHtml(brand.palette.primary)}"></span>
          <span>${escapeHtml(brand.name)}</span>
          <strong>${escapeHtml(brand.logoMimeType.replace("image/", ""))}</strong>
        </button>
      `
    )
    .join("");

  brandList.querySelectorAll<HTMLButtonElement>("[data-brand-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const brandId = button.dataset.brandId;

      if (brandId) {
        void selectBrand(brandId, button.dataset.brandName);
      }
    });
  });
}

async function selectBrand(brandId: string, brandName?: string): Promise<void> {
  try {
    const schema = await api.layout.schema(brandId);
    layoutState.activeBrand = null;
    layoutState.activeSchema = schema;
    applySchema(schema, brandName);
    layoutImage.src = api.layout.layoutUrl(brandId);
    renderBrandListSelection(brandId);
  } catch (error) {
    schemaMeta.textContent = errorMessage(error);
  }
}

async function setActiveBrand(brand: LayoutBuilderBrandResponse): Promise<void> {
  layoutState.activeBrand = brand;
  layoutState.activeSchema = brand;
  applySchema(brand, brand.name);
  layoutImage.src = api.layout.layoutUrl(brand.brandId);
  renderBrandListSelection(brand.brandId);
}

function applySchema(schema: LayoutBuilderBrandSchemaResponse, brandName?: string): void {
  schemaMeta.innerHTML = `
    <strong>${escapeHtml(schema.endpoint)}</strong>
    <span>${escapeHtml(schema.methods.join(" / "))} · ${escapeHtml(schema.fieldsStyle)} · ${escapeHtml(schema.structure)} · ${escapeHtml(schema.layoutVariant)}</span>
  `;
  selectedBrandTitle.textContent = brandName ? `${brandName} · ${schema.brandId}` : schema.brandId;
  deleteBrandButton.disabled = false;
  contractEndpoint.value = schema.endpoint;
  layoutPayload.value = formatJson(schema.samplePayload);
  contractResponse.textContent = "No contract request sent yet.";
  setContractMethod(activeContractMethod);
}

function renderBrandListSelection(brandId: string): void {
  brandList.querySelectorAll<HTMLButtonElement>("[data-brand-id]").forEach((button) => {
    button.classList.toggle("active", button.dataset.brandId === brandId);
  });
}

function clearLayoutSelection(): void {
  layoutState.activeBrand = null;
  layoutState.activeSchema = null;
  selectedBrandTitle.textContent = "No brand selected";
  deleteBrandButton.disabled = true;
  schemaMeta.textContent = "Create or select a brand to load its schema.";
  contractEndpoint.value = "";
  layoutPayload.value = "";
  contractResponse.textContent = "No contract request sent yet.";
  layoutImage.removeAttribute("src");
}

async function deleteActiveBrand(): Promise<void> {
  const schema = layoutState.activeSchema;

  if (!schema) {
    return;
  }

  if (!window.confirm(`Delete brand ${schema.brandId}?`)) {
    return;
  }

  deleteBrandButton.disabled = true;
  contractResponse.textContent = "Deleting brand...";

  try {
    await api.layout.deleteBrand(schema.brandId);
    clearLayoutSelection();
    await refreshBrands();
  } catch (error) {
    deleteBrandButton.disabled = false;
    contractResponse.textContent = errorMessage(error);
  }
}

function setContractMethod(method: ContractMethod): void {
  activeContractMethod = method;
  contractBodyWrap.hidden = method === "GET";
  sendContract.textContent = `Send ${method}`;

  document.querySelectorAll<HTMLButtonElement>("[data-contract-method]").forEach((button) => {
    button.classList.toggle("active", button.dataset.contractMethod === method);
  });
}

async function sendContractRequest(): Promise<void> {
  const schema = layoutState.activeSchema;

  if (!schema) {
    schemaMeta.textContent = "Create or select a brand first.";
    return;
  }

  sendContract.disabled = true;
  contractResponse.textContent = "Sending...";

  try {
    if (activeContractMethod === "GET") {
      const response = await api.layout.fetchContract(schema.endpoint);
      contractResponse.textContent = formatJson(response);
      return;
    }

    const payload = parseJson(layoutPayload.value);
    const response = await api.layout.configure(schema.endpoint, payload);
    contractResponse.textContent = formatJson(response);
    layoutImage.src = api.layout.layoutUrl(schema.brandId);
  } catch (error) {
    contractResponse.textContent = errorMessage(error);
  } finally {
    sendContract.disabled = false;
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
  return value.length > 14 ? `${value.slice(0, 10)}…` : value;
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
