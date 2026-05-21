import { StrictMode, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

type RuntimeView = "login" | "dashboard" | "payments" | "customers" | "balances";

interface RuntimeContract {
  brandId: string;
  brandName: string;
  resourceAlias: string;
  statusMap: Record<string, string>;
  actionLabels: {
    register: string;
    login: string;
    createPayment: string;
    history: string;
    refund: string;
  };
  fields: Record<string, string>;
  accountFields: Record<string, string>;
  userFields: Record<string, string>;
  authFields: Record<string, string>;
  endpoints: Record<string, string>;
}

interface RuntimeLocation {
  brandId: string;
  routeBase: string;
  slug: string;
  view: RuntimeView;
}

interface RuntimeAuthResponse {
  sessionToken: string;
  user: Record<string, unknown>;
  account: Record<string, unknown>;
}

interface RuntimeHistoryResponse {
  account: Record<string, unknown>;
  [resourceAlias: string]: unknown;
}

interface BrandSchemaResponse {
  appUrl: string;
  brandId: string;
  endpoint: string;
  generationProfile: {
    contractSummary: string;
    visualDirection: string;
  } | null;
  name: string;
  palette: {
    accent: string;
    background: string;
    primary: string;
    secondary: string;
    surface: string;
    text: string;
  };
}

interface BrandShell {
  logoDataUri: string | null;
  schema: BrandSchemaResponse;
}

const layoutApiBase = import.meta.env.VITE_LAYOUT_API_BASE ?? "/layout-api";
const root = document.querySelector("#root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <BrandRuntimeApp />
  </StrictMode>
);

function BrandRuntimeApp() {
  const [locationState, setLocationState] = useState(() => parseRuntimeLocation());
  const [brandShell, setBrandShell] = useState<BrandShell | null>(null);
  const [contract, setContract] = useState<RuntimeContract | null>(null);
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(sessionKey(locationState)));
  const [identity, setIdentity] = useState<RuntimeAuthResponse | null>(null);
  const [historyState, setHistoryState] = useState<RuntimeHistoryResponse | null>(null);
  const [status, setStatus] = useState("Sign in to open this payments workspace.");

  useEffect(() => {
    const onPopState = () => setLocationState(parseRuntimeLocation());

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadBrand() {
      const [schema, runtimeContract] = await Promise.all([
        requestJson<BrandSchemaResponse>(`${layoutApiBase}/brands/${locationState.brandId}/schema`),
        requestJson<RuntimeContract>(runtimeUrl(locationState, "config"))
      ]);
      const logoDataUri = await loadLogoDataUri(locationState.brandId);

      if (!active) {
        return;
      }

      setBrandShell({ logoDataUri, schema });
      setContract(runtimeContract);
    }

    loadBrand().catch((error: unknown) => setStatus(errorMessage(error)));

    return () => {
      active = false;
    };
  }, [locationState.brandId, locationState.slug]);

  useEffect(() => {
    setSessionToken(localStorage.getItem(sessionKey(locationState)));
  }, [locationState.brandId]);

  useEffect(() => {
    if (!contract || !sessionToken) {
      return;
    }

    refreshHistory().catch((error: unknown) => setStatus(errorMessage(error)));
  }, [contract, sessionToken]);

  const payments = useMemo(
    () => paymentsFromHistory(contract, historyState),
    [contract, historyState]
  );
  const account = historyState?.account ?? identity?.account ?? null;
  const metrics = contract ? paymentMetrics(contract, payments) : emptyMetrics();

  if (!locationState.brandId || !locationState.slug) {
    return <ErrorScreen message="Open a brand route like /brands/:brandId/:slug/login." />;
  }

  if (!brandShell || !contract) {
    return <ErrorScreen message={status === "" ? "Loading brand runtime." : status} />;
  }

  const view = sessionToken ? locationState.view : "login";
  const shellStyle = {
    "--accent": brandShell.schema.palette.accent,
    "--primary": brandShell.schema.palette.primary,
    "--secondary": brandShell.schema.palette.secondary,
    "--surface": brandShell.schema.palette.surface,
    "--text": brandShell.schema.palette.text
  } as CSSProperties;

  async function authenticate(mode: "login" | "register", form: HTMLFormElement) {
    if (!contract) {
      return;
    }

    const formData = new FormData(form);
    const payload = {
      [contract.authFields.email ?? "email"]: String(formData.get("email") ?? ""),
      [contract.authFields.password ?? "password"]: String(formData.get("password") ?? ""),
      [contract.authFields.displayName ?? "displayName"]: String(formData.get("displayName") ?? ""),
      [contract.authFields.currency ?? "currency"]: String(formData.get("currency") ?? "USD")
    };
    const response = await requestJson<RuntimeAuthResponse>(runtimeUrl(locationState, mode), {
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
      method: "POST"
    });

    localStorage.setItem(sessionKey(locationState), response.sessionToken);
    setSessionToken(response.sessionToken);
    setIdentity(response);
    setStatus(mode === "register" ? "Account created." : "Signed in.");
    await refreshHistory(response.sessionToken);
    navigateTo(locationState, "dashboard", setLocationState);
  }

  async function refreshHistory(token = sessionToken) {
    if (!token) {
      setStatus("Sign in first.");
      return;
    }

    const response = await requestJson<RuntimeHistoryResponse>(runtimeUrl(locationState, "payments"), {
      headers: { authorization: `Bearer ${token}` }
    });

    setHistoryState(response);
    setStatus("Workspace refreshed.");
  }

  async function createPayment(form: HTMLFormElement) {
    if (!contract || !sessionToken) {
      setStatus("Sign in first.");
      navigateTo(locationState, "login", setLocationState);
      return;
    }

    const formData = new FormData(form);
    const fields = contract.fields;
    const customerName = String(formData.get("customerName") ?? "").trim();
    const customerEmail = String(formData.get("customerEmail") ?? "").trim();
    const methodType = String(formData.get("methodType") ?? "card");
    const instrumentReference = String(formData.get("instrumentReference") ?? "").trim();
    const destinationLabel = [
      customerName || "Customer",
      customerEmail || "customer@example.com",
      `${paymentSourceLabel(methodType)} ${instrumentSummary(instrumentReference)}`
    ].join(" | ");
    const payload = {
      [fields.amount ?? "amount"]: Number(formData.get("amount")),
      [fields.currency ?? "currency"]: String(formData.get("currency") ?? "USD"),
      [fields.destinationLabel ?? "destinationLabel"]: destinationLabel,
      [fields.methodType ?? "methodType"]: methodType,
      scenario: String(formData.get("scenario") ?? "settle")
    };

    await requestJson<unknown>(runtimeUrl(locationState, "payments"), {
      body: JSON.stringify(payload),
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json"
      },
      method: "POST"
    });
    setStatus("Payment created.");
    await refreshHistory();
    navigateTo(locationState, "payments", setLocationState);
  }

  function logout() {
    localStorage.removeItem(sessionKey(locationState));
    setSessionToken("");
    setIdentity(null);
    setHistoryState(null);
    setStatus("Session closed.");
    navigateTo(locationState, "login", setLocationState);
  }

  if (view === "login") {
    return (
      <main className="login-shell" style={shellStyle}>
        <section className="login-panel">
          <BrandLockup brand={brandShell} />
          <div>
            <span className="kicker">{brandShell.schema.generationProfile?.contractSummary ?? "Payments workspace"}</span>
            <h1>Sign in to your account</h1>
            <p className="subtle">Register or sign in as a merchant to process customer card and account payments.</p>
          </div>
          <AuthForm
            onSubmit={(mode, form) => {
              void authenticate(mode, form);
            }}
          />
          <div className="status">{status}</div>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell" style={shellStyle}>
      <aside className="sidebar">
        <BrandLockup brand={brandShell} />
        <Navigation current={view} locationState={locationState} setLocationState={setLocationState} />
        <div className="sidebar-footer">Process customer card and account payments for this merchant.</div>
      </aside>
      <section className="main">
        <header className="topline">
          <div>
            <span className="kicker">{brandShell.schema.generationProfile?.contractSummary ?? "Payments workspace"}</span>
            <h1>{viewTitle(view)}</h1>
            <p className="subtle">{brandShell.schema.generationProfile?.visualDirection ?? "Operate payments, balances, and account activity from one workspace."}</p>
          </div>
          <div className="top-actions">
            <button className="secondary" type="button" onClick={() => void refreshHistory()}>
              Refresh
            </button>
            <button className="secondary" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>

        {view === "dashboard" ? (
          <DashboardView
            account={account}
            contract={contract}
            metrics={metrics}
            onCreatePayment={(form) => {
              void createPayment(form);
            }}
            payments={payments}
            status={status}
          />
        ) : null}
        {view === "payments" ? <PaymentsView contract={contract} payments={payments} /> : null}
        {view === "customers" ? <CustomersView contract={contract} payments={payments} /> : null}
        {view === "balances" ? <BalancesView account={account} contract={contract} metrics={metrics} /> : null}
      </section>
    </main>
  );
}

function BrandLockup({ brand }: { brand: BrandShell }) {
  return (
    <div className="brand-lockup">
      <div className="brand-mark">{brand.logoDataUri ? <img alt={`${brand.schema.name} logo`} src={brand.logoDataUri} /> : null}</div>
      <div>
        <strong>{brand.schema.name}</strong>
        <small>Merchant gateway</small>
      </div>
    </div>
  );
}

function Navigation({
  current,
  locationState,
  setLocationState
}: {
  current: RuntimeView;
  locationState: RuntimeLocation;
  setLocationState: (value: RuntimeLocation) => void;
}) {
  const primaryItems: Array<[RuntimeView, string]> = [
    ["dashboard", "Overview"],
    ["payments", "Payments"],
    ["customers", "Customers"],
    ["balances", "Balances"]
  ];

  return (
    <div className="nav-section">
      <span className="nav-label">Merchant tools</span>
      {primaryItems.map(([view, label]) => (
        <button
          className={`nav-item${current === view ? " active" : ""}`}
          key={view}
          type="button"
          onClick={() => navigateTo(locationState, view, setLocationState)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function DashboardView({
  account,
  contract,
  metrics,
  onCreatePayment,
  payments,
  status
}: {
  account: Record<string, unknown> | null;
  contract: RuntimeContract;
  metrics: RuntimeMetrics;
  onCreatePayment: (form: HTMLFormElement) => void;
  payments: Array<Record<string, unknown>>;
  status: string;
}) {
  return (
    <>
      <MetricSummary account={account} contract={contract} metrics={metrics} />
      <div className="content-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Recent payments</h2>
          </div>
          <PaymentsTable contract={contract} payments={payments.slice(0, 8)} />
        </section>
        <section className="panel">
          <div className="side-stack">
            <div className="status">{status}</div>
            <PaymentForm onSubmit={onCreatePayment} />
          </div>
        </section>
      </div>
    </>
  );
}

function PaymentsView({ contract, payments }: { contract: RuntimeContract; payments: Array<Record<string, unknown>> }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>Payment ledger</h2>
      </div>
      <PaymentsTable contract={contract} payments={payments} />
    </section>
  );
}

function CustomersView({ contract, payments }: { contract: RuntimeContract; payments: Array<Record<string, unknown>> }) {
  const customers = customersFromPayments(contract, payments);

  return (
    <section className="panel">
      <div className="section-title">
        <h2>Customers</h2>
      </div>
      {customers.length === 0 ? (
        <div className="empty">Customers appear after the merchant processes payments.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th>Payments</th>
                <th>Total volume</th>
                <th>Last payment</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.name}>
                  <td>
                    <strong>{customer.name}</strong>
                    <small>{customer.instrument}</small>
                  </td>
                  <td>{customer.count}</td>
                  <td>{formatAmount(customer.volume, customer.currency)}</td>
                  <td>{formatDateTime(customer.lastPaymentAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BalancesView({
  account,
  contract,
  metrics
}: {
  account: Record<string, unknown> | null;
  contract: RuntimeContract;
  metrics: RuntimeMetrics;
}) {
  return (
    <>
      <MetricSummary account={account} contract={contract} metrics={metrics} />
      <section className="panel account-card">
        <h2>Balance account</h2>
        <IdentityRows account={account} contract={contract} identity={null} />
      </section>
    </>
  );
}

function MetricSummary({
  account,
  contract,
  metrics
}: {
  account: Record<string, unknown> | null;
  contract: RuntimeContract;
  metrics: RuntimeMetrics;
}) {
  const balance = account
    ? formatAmount(account[contract.accountFields.balance ?? "balance"], account[contract.accountFields.currency ?? "currency"])
    : formatAmount(0, metrics.currency);

  return (
    <div className="summary">
      <Metric caption={account ? "Live account" : "No active account"} label="Available balance" value={balance} />
      <Metric caption="Current workspace" label="Gross volume" value={formatAmount(metrics.volume, metrics.currency)} />
      <Metric caption={`${metrics.customers} customers`} label="Payments" value={String(metrics.count)} />
      <Metric caption="Review, failed, or pending" label="Needs attention" value={String(metrics.review)} />
    </div>
  );
}

function Metric({ caption, label, value }: { caption: string; label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </div>
  );
}

function AuthForm({ onSubmit }: { onSubmit: (mode: "login" | "register", form: HTMLFormElement) => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit("register", event.currentTarget);
      }}
    >
      <label>
        Merchant email
        <input autoComplete="email" defaultValue="client@example.com" name="email" required type="email" />
      </label>
      <label>
        Password
        <input autoComplete="current-password" defaultValue="local-demo-password" name="password" required type="password" />
      </label>
      <label>
        Business name
        <input defaultValue="Demo Merchant LLC" name="displayName" />
      </label>
      <input name="currency" type="hidden" value="USD" />
      <div className="button-row">
        <button className="primary" type="submit">
          Register merchant
        </button>
        <button
          className="secondary"
          type="button"
          onClick={(event) => {
            const form = event.currentTarget.closest("form");

            if (form) {
              onSubmit("login", form);
            }
          }}
        >
          Sign in
        </button>
      </div>
    </form>
  );
}

function PaymentForm({ onSubmit }: { onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event.currentTarget);
      }}
    >
      <h2>Process a payment</h2>
      <div className="row">
        <label>
          Amount
          <input defaultValue="49.99" min="0.01" name="amount" required step="0.01" type="number" />
        </label>
        <label>
          Currency
          <input defaultValue="USD" name="currency" required />
        </label>
      </div>
      <div className="row">
        <label>
          Customer
          <input defaultValue="Ava Customer" name="customerName" required />
        </label>
        <label>
          Customer email
          <input defaultValue="ava@example.com" name="customerEmail" required type="email" />
        </label>
      </div>
      <div className="row">
        <label>
          Payment source
          <select defaultValue="card" name="methodType">
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="wallet">Wallet</option>
          </select>
        </label>
        <label>
          Card or account
          <input defaultValue="4242 4242 4242 4242" name="instrumentReference" required />
        </label>
      </div>
      <label>
        Processing route
          <select defaultValue="settle" name="scenario">
          <option value="settle">Authorize and capture</option>
            <option value="review">Hold for review</option>
            <option value="reserve">Reserve funds</option>
            <option value="fail">Decline</option>
          </select>
      </label>
      <button className="primary" type="submit">
        Process payment
      </button>
    </form>
  );
}

function PaymentsTable({ contract, payments }: { contract: RuntimeContract; payments: Array<Record<string, unknown>> }) {
  const fields = contract.fields;

  if (payments.length === 0) {
    return <div className="empty">No payment activity yet.</div>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Payment</th>
            <th>Status</th>
            <th>Amount</th>
            <th>Customer</th>
            <th>Source</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => {
            const reference = String(payment[fields.externalReference ?? "externalReference"] ?? "");
            const status = String(payment[fields.status ?? "status"] ?? "");
            const customer = customerFromPayment(contract, payment);

            return (
              <tr key={String(payment[fields.paymentId ?? "paymentId"] ?? reference)}>
                <td>
                  <strong>{reference}</strong>
                </td>
                <td>
                  <span className={`badge ${statusClass(status)}`}>{status}</span>
                </td>
                <td>{formatAmount(payment[fields.amount ?? "amount"], payment[fields.currency ?? "currency"])}</td>
                <td>{customer.name}</td>
                <td>{customer.instrument}</td>
                <td>{formatDateTime(payment[fields.createdAt ?? "createdAt"])}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IdentityRows({
  account,
  contract,
  identity
}: {
  account: Record<string, unknown> | null;
  contract: RuntimeContract;
  identity: RuntimeAuthResponse | null;
}) {
  const user = identity?.user ?? null;
  const candidateRows: Array<[string, unknown]> = [
    ["Email", user?.[contract.userFields.email ?? "email"]],
    ["Owner", user?.[contract.userFields.displayName ?? "displayName"]],
    ["Account", account?.[contract.accountFields.accountId ?? "accountId"]],
    ["Currency", account?.[contract.accountFields.currency ?? "currency"]]
  ];
  const rows = candidateRows.filter((row): row is [string, string | number | boolean] => {
    const value = row[1];

    return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
  });

  if (rows.length === 0) {
    return <div className="empty">Account details appear after sign in.</div>;
  }

  return (
    <>
      {rows.map(([label, value]) => (
        <div className="identity-row" key={label}>
          <span>{label}</span>
          <strong>{String(value)}</strong>
        </div>
      ))}
    </>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <h1>Brand runtime</h1>
        <div className="status">{message}</div>
      </section>
    </main>
  );
}

interface RuntimeMetrics {
  count: number;
  currency: string;
  customers: number;
  review: number;
  volume: number;
}

function paymentMetrics(contract: RuntimeContract, payments: Array<Record<string, unknown>>): RuntimeMetrics {
  const fields = contract.fields;
  const currency = String(payments[0]?.[fields.currency ?? "currency"] ?? "USD");
  const review = payments.filter((payment) => statusClass(String(payment[fields.status ?? "status"] ?? "")) !== "ok").length;
  const volume = payments.reduce((sum, payment) => sum + Number(payment[fields.amount ?? "amount"] ?? 0), 0);

  return {
    count: payments.length,
    currency,
    customers: customersFromPayments(contract, payments).length,
    review,
    volume
  };
}

function emptyMetrics(): RuntimeMetrics {
  return {
    count: 0,
    currency: "USD",
    customers: 0,
    review: 0,
    volume: 0
  };
}

interface RuntimeCustomer {
  count: number;
  currency: string;
  instrument: string;
  lastPaymentAt: unknown;
  name: string;
  volume: number;
}

function customersFromPayments(contract: RuntimeContract, payments: Array<Record<string, unknown>>): RuntimeCustomer[] {
  const fields = contract.fields;
  const customers = new Map<string, RuntimeCustomer>();

  for (const payment of payments) {
    const customer = customerFromPayment(contract, payment);
    const amount = Number(payment[fields.amount ?? "amount"] ?? 0);
    const currency = String(payment[fields.currency ?? "currency"] ?? "USD");
    const createdAt = payment[fields.createdAt ?? "createdAt"];
    const current = customers.get(customer.name);

    if (current) {
      current.count += 1;
      current.volume += amount;
      current.lastPaymentAt = createdAt;
    } else {
      customers.set(customer.name, {
        count: 1,
        currency,
        instrument: customer.instrument,
        lastPaymentAt: createdAt,
        name: customer.name,
        volume: amount
      });
    }
  }

  return [...customers.values()].sort((left, right) => Number(right.volume) - Number(left.volume));
}

function customerFromPayment(contract: RuntimeContract, payment: Record<string, unknown>) {
  const rawDestination = String(payment[contract.fields.destinationLabel ?? "destinationLabel"] ?? "Customer");
  const [name = "Customer", emailOrId = "", instrument = "Payment source"] = rawDestination
    .split("|")
    .map((part) => part.trim());

  return {
    instrument: instrument.length > 0 ? instrument : emailOrId,
    name: name.length > 0 ? name : "Customer"
  };
}

function paymentSourceLabel(methodType: string) {
  if (methodType === "bank_transfer") {
    return "Bank account";
  }

  if (methodType === "wallet") {
    return "Wallet";
  }

  return "Card";
}

function instrumentSummary(value: string) {
  const compact = value.replace(/\s+/gu, "");

  if (compact.length <= 4) {
    return compact;
  }

  return `•••• ${compact.slice(-4)}`;
}

function paymentsFromHistory(
  contract: RuntimeContract | null,
  historyResponse: RuntimeHistoryResponse | null
): Array<Record<string, unknown>> {
  if (!contract || !historyResponse) {
    return [];
  }

  const rawPayments = historyResponse[contract.resourceAlias];

  return Array.isArray(rawPayments)
    ? rawPayments.filter((payment): payment is Record<string, unknown> => Boolean(payment) && typeof payment === "object" && !Array.isArray(payment))
    : [];
}

function parseRuntimeLocation(): RuntimeLocation {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const brandIndex = parts.indexOf("brands");
  const brandId = brandIndex >= 0 ? parts[brandIndex + 1] ?? "" : "";
  const slug = brandIndex >= 0 ? parts[brandIndex + 2] ?? "" : "";
  const rawView = brandIndex >= 0 ? parts[brandIndex + 3] ?? "dashboard" : "dashboard";
  const routeBase = brandIndex >= 0 ? `/${parts.slice(0, brandIndex + 3).join("/")}` : "";

  return {
    brandId,
    routeBase,
    slug,
    view: isRuntimeView(rawView) ? rawView : "dashboard"
  };
}

function navigateTo(
  locationState: RuntimeLocation,
  view: RuntimeView,
  setLocationState: (value: RuntimeLocation) => void
) {
  const nextLocation = {
    ...locationState,
    view
  };

  history.pushState({}, "", `${locationState.routeBase}/${view}`);
  setLocationState(nextLocation);
}

function isRuntimeView(value: string): value is RuntimeView {
  return ["login", "dashboard", "payments", "customers", "balances"].includes(value);
}

function runtimeUrl(locationState: RuntimeLocation, key: "config" | "login" | "payments" | "register") {
  return `${runtimeBasePath(locationState)}/runtime/${key}`;
}

function runtimeBasePath(locationState: RuntimeLocation) {
  return `${layoutApiBase}/brands/${locationState.brandId}/${locationState.slug}`;
}

function sessionKey(locationState: RuntimeLocation) {
  return `brand-runtime-session:${locationState.brandId}`;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as T;
}

async function loadLogoDataUri(brandId: string): Promise<string | null> {
  const response = await fetch(`${layoutApiBase}/brands/${brandId}/layout`, {
    headers: {
      accept: "image/svg+xml"
    }
  });

  if (!response.ok) {
    return null;
  }

  return `data:image/svg+xml;base64,${window.btoa(await response.text())}`;
}

function viewTitle(view: RuntimeView) {
  switch (view) {
    case "payments":
      return "Payments";
    case "customers":
      return "Customers";
    case "balances":
      return "Balances";
    default:
      return "Payments dashboard";
  }
}

function statusClass(status: string) {
  const lower = status.toLowerCase();

  if (lower.includes("fail") || lower.includes("reject") || lower.includes("declin")) {
    return "bad";
  }

  if (lower.includes("clear") || lower.includes("paid") || lower.includes("settle") || lower.includes("complete")) {
    return "ok";
  }

  if (lower.includes("review") || lower.includes("process") || lower.includes("queue") || lower.includes("confirm")) {
    return "warn";
  }

  return "muted";
}

function formatAmount(amount: unknown, currency: unknown) {
  return new Intl.NumberFormat(undefined, {
    currency: String(currency || "USD"),
    maximumFractionDigits: 2,
    style: "currency"
  }).format(Number(amount || 0));
}

function formatDateTime(value: unknown) {
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(String(value)));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected runtime error";
}
