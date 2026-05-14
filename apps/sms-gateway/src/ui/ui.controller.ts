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
    <title>SMS Gateway</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f7f9;
        --panel: #ffffff;
        --text: #17202a;
        --muted: #5f6b7a;
        --line: #d9dee7;
        --primary: #1769aa;
        --primary-strong: #0f4f82;
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
        width: min(1120px, calc(100% - 32px));
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
        min-width: 120px;
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
        grid-template-columns: minmax(0, 1fr) minmax(320px, 0.8fr);
        gap: 16px;
      }

      section {
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
        padding: 18px;
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
        font-weight: 600;
      }

      input,
      textarea {
        width: 100%;
        border: 1px solid #c7ced9;
        border-radius: 6px;
        padding: 10px 12px;
        color: var(--text);
        font: inherit;
        font-size: 15px;
        outline: none;
      }

      textarea {
        min-height: 128px;
        resize: vertical;
      }

      input:focus,
      textarea:focus {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px rgba(23, 105, 170, 0.14);
      }

      .row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 0.5fr);
        gap: 12px;
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

      pre {
        min-height: 272px;
        max-height: 540px;
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

      @media (max-width: 820px) {
        main {
          width: min(100% - 24px, 1120px);
          padding: 20px 0;
        }

        header,
        .grid,
        .row {
          grid-template-columns: 1fr;
        }

        header {
          display: grid;
          align-items: start;
        }

        .health {
          text-align: left;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>SMS Gateway</h1>
        </div>
        <div class="health" id="health">Health: checking</div>
      </header>

      <div class="grid">
        <section>
          <h2>Send SMS</h2>
          <form id="sendForm">
            <div class="row">
              <label>
                Phone number
                <input name="phoneNumber" value="+919876543210" autocomplete="tel" required />
              </label>
              <label>
                Idempotency key
                <input name="idempotencyKey" value="" placeholder="optional" />
              </label>
            </div>
            <label>
              Message
              <textarea name="message" required>Your OTP is 123456</textarea>
            </label>
            <label>
              Metadata JSON
              <textarea name="metadata">{"source":"web-ui"}</textarea>
            </label>
            <div class="actions">
              <button type="submit" id="sendButton">Send</button>
              <button type="button" class="secondary" id="clearButton">Clear output</button>
              <span class="status" id="sendStatus"></span>
            </div>
          </form>
        </section>

        <section>
          <h2>Check Status</h2>
          <form id="statusForm">
            <label>
              Job ID
              <input name="jobId" autocomplete="off" required />
            </label>
            <div class="actions">
              <button type="submit" id="statusButton">Check</button>
              <span class="status" id="lookupStatus"></span>
            </div>
          </form>
          <pre id="output">Ready.</pre>
        </section>
      </div>
    </main>

    <script>
      const sendForm = document.querySelector("#sendForm");
      const statusForm = document.querySelector("#statusForm");
      const output = document.querySelector("#output");
      const sendStatus = document.querySelector("#sendStatus");
      const lookupStatus = document.querySelector("#lookupStatus");
      const health = document.querySelector("#health");
      const sendButton = document.querySelector("#sendButton");
      const statusButton = document.querySelector("#statusButton");
      const clearButton = document.querySelector("#clearButton");

      function setStatus(element, message, type = "") {
        element.textContent = message;
        element.className = type ? "status " + type : "status";
      }

      function writeOutput(title, value) {
        output.textContent = title + "\\n" + JSON.stringify(value, null, 2);
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

      sendForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        sendButton.disabled = true;
        setStatus(sendStatus, "Sending");

        const form = new FormData(sendForm);
        const metadataText = String(form.get("metadata") || "").trim();
        const payload = {
          phoneNumber: String(form.get("phoneNumber") || "").trim(),
          message: String(form.get("message") || "").trim()
        };

        try {
          if (metadataText) {
            payload.metadata = JSON.parse(metadataText);
          }

          const headers = { "Content-Type": "application/json" };
          const idempotencyKey = String(form.get("idempotencyKey") || "").trim();
          if (idempotencyKey) {
            headers["Idempotency-Key"] = idempotencyKey;
          }

          const result = await requestJson("/sms/send", {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
          });

          statusForm.elements.jobId.value = result.jobId;
          setStatus(sendStatus, "Queued", "ok");
          writeOutput("Send response", result);
        } catch (error) {
          setStatus(sendStatus, error.message, "error");
          writeOutput("Send error", error.body || { message: error.message });
        } finally {
          sendButton.disabled = false;
        }
      });

      statusForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        statusButton.disabled = true;
        setStatus(lookupStatus, "Checking");

        const jobId = String(new FormData(statusForm).get("jobId") || "").trim();

        try {
          const result = await requestJson("/sms/status/" + encodeURIComponent(jobId));
          setStatus(lookupStatus, result.status, "ok");
          writeOutput("Status response", result);
        } catch (error) {
          setStatus(lookupStatus, error.message, "error");
          writeOutput("Status error", error.body || { message: error.message });
        } finally {
          statusButton.disabled = false;
        }
      });

      clearButton.addEventListener("click", () => {
        output.textContent = "Ready.";
        setStatus(sendStatus, "");
        setStatus(lookupStatus, "");
      });

      void refreshHealth();
    </script>
  </body>
</html>`;
  }
}
