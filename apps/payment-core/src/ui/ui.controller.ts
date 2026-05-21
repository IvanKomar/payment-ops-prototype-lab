import { Controller, Get, Header } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";

@ApiTags("ui")
@Controller()
export class UiController {
  @Get()
  @Header("Content-Type", "text/html; charset=utf-8")
  @ApiOkResponse({ description: "Local Payment Core demo UI" })
  index(): string {
    return paymentCoreHtml();
  }
}

function paymentCoreHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment Core Demo</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #172033; background: #f4f7fb; }
      * { box-sizing: border-box; }
      body { margin: 0; }
      main { width: min(1120px, calc(100vw - 32px)); margin: 0 auto; padding: 28px 0 44px; }
      header { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 22px; }
      h1, h2 { margin: 0; line-height: 1.05; letter-spacing: 0; }
      h1 { font-size: 30px; }
      h2 { font-size: 18px; }
      .eyebrow { margin: 0 0 8px; color: #5d6b82; font-size: 12px; font-weight: 700; text-transform: uppercase; }
      .grid { display: grid; grid-template-columns: 360px minmax(0, 1fr); gap: 18px; align-items: start; }
      .panel { background: #ffffff; border: 1px solid #dbe3ef; border-radius: 8px; padding: 18px; box-shadow: 0 16px 40px rgba(28, 43, 72, 0.08); }
      form { display: grid; gap: 12px; margin-top: 14px; }
      label { display: grid; gap: 6px; color: #334155; font-size: 13px; font-weight: 700; }
      input, select { width: 100%; border: 1px solid #c9d4e5; border-radius: 6px; padding: 10px 11px; font: inherit; color: #172033; background: #fff; }
      button { border: 0; border-radius: 6px; padding: 10px 12px; font: inherit; font-weight: 800; color: #fff; background: #1267d8; cursor: pointer; }
      button.secondary { color: #172033; background: #e8eef7; }
      button:disabled { cursor: not-allowed; opacity: 0.55; }
      .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .status { min-height: 42px; margin-top: 12px; padding: 10px; border-radius: 6px; background: #eef4ff; color: #26456f; font-size: 13px; overflow-wrap: anywhere; }
      .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 14px; }
      .account { color: #5d6b82; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      th, td { padding: 11px 9px; border-bottom: 1px solid #e3e9f2; text-align: left; vertical-align: top; }
      th { color: #5d6b82; font-size: 11px; text-transform: uppercase; }
      .badge { display: inline-flex; align-items: center; min-height: 24px; border-radius: 999px; padding: 0 9px; font-size: 12px; font-weight: 800; background: #edf2f7; color: #334155; }
      .badge.settled, .badge.captured, .badge.authorized { background: #dff7ea; color: #11613a; }
      .badge.failed, .badge.canceled { background: #fee6e6; color: #a12323; }
      .badge.processing, .badge.requires_confirmation, .badge.requires_payment_method { background: #fff4d7; color: #7a4a00; }
      @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } header { align-items: flex-start; flex-direction: column; } }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <p class="eyebrow">Payment Core</p>
          <h1>Brand-scoped auth and payment simulation</h1>
        </div>
        <button class="secondary" id="refresh" type="button">Refresh history</button>
      </header>
      <section class="grid">
        <article class="panel">
          <h2>Register or login</h2>
          <form id="auth-form">
            <label>Brand ID <input name="brandId" value="br_koi_demo" required /></label>
            <label>Email <input name="email" value="alex@example.com" type="email" required /></label>
            <label>Password <input name="password" value="local-demo-password" type="password" required /></label>
            <label>Display name <input name="displayName" value="Alex Merchant" /></label>
            <div class="row">
              <button id="register" type="submit" data-mode="register">Register</button>
              <button class="secondary" id="login" type="button">Login</button>
            </div>
          </form>
          <div class="status" id="auth-status">No active session.</div>
          <h2 style="margin-top: 22px;">Create payment</h2>
          <form id="payment-form">
            <div class="row">
              <label>Amount <input name="amount" type="number" step="0.01" value="49.99" required /></label>
              <label>Currency <input name="currency" value="USD" required /></label>
            </div>
            <label>Destination <input name="destinationLabel" value="settle-demo-address" required /></label>
            <div class="row">
              <label>Method
                <select name="methodType">
                  <option value="card">card</option>
                  <option value="bank_transfer">bank_transfer</option>
                  <option value="wallet">wallet</option>
                  <option value="crypto">crypto</option>
                  <option value="manual">manual</option>
                </select>
              </label>
              <label>Scenario
                <select name="scenario">
                  <option value="demo">demo</option>
                  <option value="requires_action">requires_action</option>
                  <option value="fail">fail</option>
                  <option value="review">review</option>
                  <option value="reserve">reserve</option>
                  <option value="settle" selected>settle</option>
                  <option value="refund">refund</option>
                </select>
              </label>
            </div>
            <button type="submit">Create payment</button>
          </form>
          <div class="status" id="payment-status">Create or login to a session first.</div>
        </article>
        <article class="panel">
          <div class="toolbar">
            <h2>Payment history</h2>
            <span class="account" id="account-label">No account</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Destination</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody id="payments"><tr><td colspan="5">No payments yet.</td></tr></tbody>
          </table>
        </article>
      </section>
    </main>
    <script>
      const tokenKey = "payment-core-session-token";
      const authForm = document.querySelector("#auth-form");
      const paymentForm = document.querySelector("#payment-form");
      const authStatus = document.querySelector("#auth-status");
      const paymentStatus = document.querySelector("#payment-status");
      const payments = document.querySelector("#payments");
      const accountLabel = document.querySelector("#account-label");
      let sessionToken = localStorage.getItem(tokenKey) || "";

      document.querySelector("#login").addEventListener("click", () => authenticate("login"));
      authForm.addEventListener("submit", (event) => {
        event.preventDefault();
        authenticate("register");
      });
      paymentForm.addEventListener("submit", (event) => {
        event.preventDefault();
        createPayment();
      });
      document.querySelector("#refresh").addEventListener("click", () => refreshHistory());

      if (sessionToken) {
        refreshHistory();
      }

      async function authenticate(mode) {
        const form = new FormData(authForm);
        const payload = {
          brandId: String(form.get("brandId") || "").trim(),
          email: String(form.get("email") || "").trim(),
          password: String(form.get("password") || ""),
          displayName: String(form.get("displayName") || "").trim() || undefined,
          currency: "USD"
        };
        const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
        authStatus.textContent = mode === "register" ? "Registering..." : "Logging in...";
        try {
          const response = await request(endpoint, { method: "POST", body: JSON.stringify(payload) }, false);
          sessionToken = response.sessionToken;
          localStorage.setItem(tokenKey, sessionToken);
          authStatus.textContent = response.user.brandId + " / " + response.user.email;
          renderHistory({ account: response.account, payments: [] });
          await refreshHistory();
        } catch (error) {
          authStatus.textContent = error.message;
        }
      }

      async function createPayment() {
        const form = new FormData(paymentForm);
        const payload = {
          amount: Number(form.get("amount")),
          currency: String(form.get("currency") || "USD"),
          destinationLabel: String(form.get("destinationLabel") || ""),
          methodType: String(form.get("methodType") || "card"),
          scenario: String(form.get("scenario") || "demo")
        };
        paymentStatus.textContent = "Creating payment...";
        try {
          const response = await request("/payments", { method: "POST", body: JSON.stringify(payload) }, true);
          paymentStatus.textContent = response.payment.externalReference + " -> " + response.payment.status;
          await refreshHistory();
        } catch (error) {
          paymentStatus.textContent = error.message;
        }
      }

      async function refreshHistory() {
        if (!sessionToken) {
          payments.innerHTML = '<tr><td colspan="5">No active session.</td></tr>';
          return;
        }
        try {
          renderHistory(await request("/payments/history", { method: "GET" }, true));
        } catch (error) {
          payments.innerHTML = '<tr><td colspan="5">' + escapeHtml(error.message) + '</td></tr>';
        }
      }

      async function request(path, init, authorized) {
        const headers = { "content-type": "application/json", ...(init.headers || {}) };
        if (authorized) {
          headers.authorization = "Bearer " + sessionToken;
        }
        const response = await fetch(path, { ...init, headers });
        if (!response.ok) {
          throw new Error(await response.text());
        }
        return response.json();
      }

      function renderHistory(history) {
        accountLabel.textContent = history.account.accountId + " / " + history.account.currency + " " + history.account.balance.toFixed(2);
        if (!history.payments.length) {
          payments.innerHTML = '<tr><td colspan="5">No payments yet.</td></tr>';
          return;
        }
        payments.innerHTML = history.payments.map((payment) => '<tr>' +
          '<td>' + escapeHtml(payment.externalReference) + '<br><small>' + escapeHtml(payment.methodType) + '</small></td>' +
          '<td><span class="badge ' + escapeHtml(payment.status) + '">' + escapeHtml(payment.status) + '</span></td>' +
          '<td>' + escapeHtml(payment.currency) + ' ' + Number(payment.amount).toFixed(2) + '</td>' +
          '<td>' + escapeHtml(payment.destinationLabel) + '</td>' +
          '<td>' + new Date(payment.createdAt).toLocaleString() + '</td>' +
        '</tr>').join("");
      }

      function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (char) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[char]);
      }
    </script>
  </body>
</html>`;
}
