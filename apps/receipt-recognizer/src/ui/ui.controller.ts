import { Controller, Get, Header } from "@nestjs/common";

@Controller()
export class UiController {
  @Get()
  @Header("Content-Type", "text/html; charset=utf-8")
  getIndex(): string {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Receipt Recognizer</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5f7fa;
        --panel: #ffffff;
        --text: #17202a;
        --muted: #5d6b7a;
        --line: #d7dee8;
        --primary: #13735b;
        --primary-strong: #0d5945;
        --danger: #b42318;
        --ok: #087443;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      main {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0;
      }

      header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 20px;
        margin-bottom: 20px;
      }

      h1,
      h2 {
        margin: 0;
        letter-spacing: 0;
      }

      h1 {
        font-size: 30px;
        line-height: 1.15;
      }

      h2 {
        font-size: 18px;
        line-height: 1.3;
      }

      .health {
        min-width: 132px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: var(--panel);
        padding: 8px 12px;
        color: var(--muted);
        font-size: 14px;
        text-align: right;
      }

      .grid {
        display: grid;
        grid-template-columns: minmax(320px, 0.7fr) minmax(0, 1fr);
        gap: 16px;
      }

      section {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 18px;
      }

      .history {
        margin-top: 16px;
      }

      form {
        display: grid;
        gap: 14px;
        margin-top: 16px;
      }

      label {
        display: grid;
        gap: 6px;
        color: var(--muted);
        font-size: 13px;
        font-weight: 700;
      }

      input[type="file"],
      select,
      input[type="text"] {
        width: 100%;
        border: 1px solid #c7ced9;
        border-radius: 6px;
        padding: 10px 12px;
        color: var(--text);
        font: inherit;
        font-size: 15px;
        outline: none;
      }

      input:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(19, 115, 91, 0.14);
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        align-items: center;
      }

      button {
        min-height: 40px;
        border: 1px solid transparent;
        border-radius: 6px;
        background: var(--primary);
        color: #ffffff;
        padding: 9px 14px;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      button.secondary {
        border-color: #b9c3d0;
        background: #ffffff;
        color: var(--text);
      }

      button:disabled {
        cursor: wait;
        opacity: 0.7;
      }

      button:not(:disabled):hover {
        background: var(--primary-strong);
      }

      button.secondary:not(:disabled):hover {
        background: #eef2f6;
      }

      .status {
        min-height: 22px;
        color: var(--muted);
        font-size: 14px;
      }

      .status.error {
        color: var(--danger);
      }

      .status.ok {
        color: var(--ok);
      }

      .result-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        margin-top: 16px;
      }

      .field {
        min-height: 64px;
        border: 1px solid #d7dde6;
        border-radius: 6px;
        padding: 10px;
      }

      .field span {
        display: block;
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
      }

      .field strong {
        display: block;
        margin-top: 6px;
        overflow-wrap: anywhere;
        font-size: 15px;
      }

      pre {
        max-height: 360px;
        overflow: auto;
        margin: 16px 0 0;
        border: 1px solid #d7dde6;
        border-radius: 6px;
        background: #101820;
        color: #e7edf5;
        padding: 14px;
        font-size: 13px;
        line-height: 1.45;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .table-wrap {
        overflow-x: auto;
        margin-top: 14px;
        border: 1px solid var(--line);
        border-radius: 6px;
      }

      table {
        width: 100%;
        min-width: 1040px;
        border-collapse: collapse;
        font-size: 13px;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 10px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: #f0f3f7;
        color: var(--muted);
        font-weight: 700;
      }

      tr:last-child td {
        border-bottom: 0;
      }

      .mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        border: 1px solid #ccd5df;
        border-radius: 999px;
        padding: 2px 8px;
        background: #f8fafc;
        color: var(--text);
        font-size: 12px;
        font-weight: 700;
      }

      .confidence-required {
        border-color: #8cc7a6;
        background: #e8f7ee;
        color: #08613b;
      }

      .confidence-usable {
        border-color: #94b9e8;
        background: #edf5ff;
        color: #164f8f;
      }

      .confidence-discouraged {
        border-color: #f0c06a;
        background: #fff6df;
        color: #875200;
      }

      .confidence-blocked {
        border-color: #e79b94;
        background: #fff0ee;
        color: #9f2419;
      }

      @media (max-width: 840px) {
        main {
          width: min(100% - 24px, 1180px);
          padding: 20px 0;
        }

        header,
        .grid,
        .result-grid {
          display: grid;
          grid-template-columns: 1fr;
          align-items: start;
        }

        .health {
          text-align: left;
        }

        table {
          min-width: 860px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Receipt Recognizer</h1>
        </div>
        <div class="health" id="health">Health: checking</div>
      </header>

      <div class="grid">
        <section>
          <h2>Upload Receipt</h2>
          <form id="uploadForm">
            <label>
              Screenshot
              <input name="file" type="file" accept="image/jpeg,image/png,image/webp" required />
            </label>
            <label>
              Recognition model
              <select name="model">
                <option value="tesseract" selected>Tesseract OCR</option>
                <option value="gemini">Gemini</option>
              </select>
            </label>
            <div class="actions">
              <button type="submit" id="uploadButton">Upload</button>
              <button type="button" class="secondary" id="clearButton">Clear</button>
              <span class="status" id="uploadStatus"></span>
            </div>
          </form>
        </section>

        <section>
          <div class="actions">
            <h2>Parsed Result</h2>
            <button type="button" class="secondary" id="rawButton" disabled>Show raw OCR</button>
          </div>
          <div class="result-grid" id="resultGrid">
            <div class="field"><span>Receipt</span><strong>Ready.</strong></div>
          </div>
          <pre id="rawOutput" hidden></pre>
        </section>
      </div>

      <section class="history">
        <div class="actions">
          <h2>Recent Receipts</h2>
          <button type="button" class="secondary" id="refreshButton">Refresh</button>
          <span class="status" id="recentStatus"></span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>Recipient</th>
                <th>Amount</th>
                <th>Bank</th>
                <th>Model</th>
                <th>Transaction ID</th>
                <th>UTR</th>
                <th>Confidence</th>
                <th>Receipt ID</th>
              </tr>
            </thead>
            <tbody id="recentBody">
              <tr><td colspan="9">Loading.</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </main>

    <script>
      const uploadForm = document.querySelector("#uploadForm");
      const uploadButton = document.querySelector("#uploadButton");
      const clearButton = document.querySelector("#clearButton");
      const refreshButton = document.querySelector("#refreshButton");
      const rawButton = document.querySelector("#rawButton");
      const uploadStatus = document.querySelector("#uploadStatus");
      const recentStatus = document.querySelector("#recentStatus");
      const health = document.querySelector("#health");
      const resultGrid = document.querySelector("#resultGrid");
      const recentBody = document.querySelector("#recentBody");
      const rawOutput = document.querySelector("#rawOutput");
      let selectedReceiptId = "";

      function setStatus(element, message, type = "") {
        element.textContent = message;
        element.className = type ? "status " + type : "status";
      }

      function formatDate(value) {
        if (!value) {
          return "";
        }

        return new Intl.DateTimeFormat(undefined, {
          dateStyle: "short",
          timeStyle: "medium"
        }).format(new Date(value));
      }

      function formatAmount(receipt) {
        if (receipt.amount === null || receipt.amount === undefined) {
          return "";
        }

        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: receipt.currency || "INR",
          maximumFractionDigits: 2
        }).format(receipt.amount);
      }

      function getConfidenceMeta(value) {
        const confidence = Number(value);

        if (!Number.isFinite(confidence)) {
          return {
            className: "confidence-blocked"
          };
        }

        if (confidence >= 0.9) {
          return {
            className: "confidence-required"
          };
        }

        if (confidence >= 0.75) {
          return {
            className: "confidence-usable"
          };
        }

        if (confidence >= 0.5) {
          return {
            className: "confidence-discouraged"
          };
        }

        return {
          className: "confidence-blocked"
        };
      }

      function formatConfidence(value) {
        const confidence = Number(value);

        if (!Number.isFinite(confidence)) {
          return "Not found";
        }

        return Math.round(confidence * 100) + "%";
      }

      function createConfidenceBadge(value) {
        const meta = getConfidenceMeta(value);
        const badge = document.createElement("span");
        badge.className = "badge " + meta.className;
        badge.textContent = formatConfidence(value);
        return badge;
      }

      function renderResult(receipt) {
        selectedReceiptId = receipt.receiptId;
        rawButton.disabled = false;
        rawOutput.hidden = true;
        rawOutput.textContent = "";

        const fields = [
          ["Recipient", receipt.recipient],
          ["Amount", formatAmount(receipt)],
          ["Bank", receipt.bank],
          ["Model", receipt.requestedModel === receipt.recognitionModel ? receipt.recognitionModel : receipt.requestedModel + " -> " + receipt.recognitionModel],
          ["Date", receipt.transactionDate ? formatDate(receipt.transactionDate) : ""],
          ["Sender", receipt.sender],
          ["Transaction ID", receipt.transactionId],
          ["UTR", receipt.utr],
          ["Confidence", receipt.confidence]
        ];

        resultGrid.replaceChildren(
          ...fields.map(([label, value]) => {
            const item = document.createElement("div");
            item.className = "field";
            const caption = document.createElement("span");
            caption.textContent = label;
            const strong = document.createElement("strong");

            if (label === "Confidence") {
              strong.append(createConfidenceBadge(value));
            } else {
              strong.textContent = value === null || value === undefined || value === "" ? "Not found" : String(value);
            }

            item.append(caption, strong);
            return item;
          })
        );
      }

      function renderRecent(receipts) {
        if (!receipts.length) {
          recentBody.innerHTML = '<tr><td colspan="9">No receipts yet.</td></tr>';
          return;
        }

        recentBody.replaceChildren(
          ...receipts.map((receipt) => {
            const row = document.createElement("tr");
            const cells = [
              formatDate(receipt.createdAt),
              receipt.recipient || "",
              formatAmount(receipt),
              receipt.bank || "",
              receipt.requestedModel === receipt.recognitionModel
                ? receipt.recognitionModel
                : receipt.requestedModel + " -> " + receipt.recognitionModel,
              receipt.transactionId || "",
              receipt.utr || "",
              String(receipt.confidence),
              receipt.receiptId
            ];

            for (const value of cells) {
              const cell = document.createElement("td");
              cell.textContent = value;
              row.append(cell);
            }

            row.children[7].textContent = "";
            row.children[7].append(createConfidenceBadge(receipt.confidence));
            row.children[8].className = "mono";
            row.addEventListener("click", () => {
              void loadReceipt(receipt.receiptId);
            });

            return row;
          })
        );
      }

      async function requestJson(url, options = {}) {
        const response = await fetch(url, options);
        const text = await response.text();
        const body = text ? JSON.parse(text) : null;

        if (!response.ok) {
          const error = new Error(body?.message || response.statusText);
          error.body = body;
          throw error;
        }

        return body;
      }

      async function refreshHealth() {
        try {
          const result = await requestJson("/health");
          health.textContent = "Health: " + result.status;
        } catch {
          health.textContent = "Health: unavailable";
        }
      }

      async function refreshRecent() {
        refreshButton.disabled = true;
        setStatus(recentStatus, "Refreshing");

        try {
          const receipts = await requestJson("/receipts/recent");
          renderRecent(receipts);
          setStatus(recentStatus, "Loaded", "ok");
        } catch (error) {
          setStatus(recentStatus, error.message, "error");
        } finally {
          refreshButton.disabled = false;
        }
      }

      async function loadReceipt(receiptId) {
        const receipt = await requestJson("/receipts/" + encodeURIComponent(receiptId));
        renderResult(receipt);
      }

      uploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        uploadButton.disabled = true;
        setStatus(uploadStatus, "Running OCR");

        try {
          const result = await requestJson("/receipts/upload", {
            method: "POST",
            body: new FormData(uploadForm)
          });
          await loadReceipt(result.receiptId);
          await refreshRecent();
          setStatus(uploadStatus, "Saved", "ok");
        } catch (error) {
          setStatus(uploadStatus, error.message, "error");
        } finally {
          uploadButton.disabled = false;
        }
      });

      rawButton.addEventListener("click", async () => {
        if (!selectedReceiptId) {
          return;
        }

        if (!rawOutput.hidden) {
          rawOutput.hidden = true;
          rawButton.textContent = "Show raw OCR";
          return;
        }

        const result = await requestJson("/receipts/" + encodeURIComponent(selectedReceiptId) + "/raw");
        rawOutput.textContent = result.rawText || "No OCR text.";
        rawOutput.hidden = false;
        rawButton.textContent = "Hide raw OCR";
      });

      clearButton.addEventListener("click", () => {
        uploadForm.reset();
        selectedReceiptId = "";
        rawButton.disabled = true;
        rawButton.textContent = "Show raw OCR";
        rawOutput.hidden = true;
        rawOutput.textContent = "";
        resultGrid.innerHTML = '<div class="field"><span>Receipt</span><strong>Ready.</strong></div>';
        setStatus(uploadStatus, "");
      });

      refreshButton.addEventListener("click", () => {
        void refreshRecent();
      });

      void refreshHealth();
      void refreshRecent();
    </script>
  </body>
</html>`;
  }
}
