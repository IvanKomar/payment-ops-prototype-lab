import { StrictMode, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

type RuntimeView = "login" | "dashboard" | "payments" | "customers" | "balances";

type RuntimePresentation = NonNullable<RuntimeShell["ui"]>["presentation"];

interface RuntimeLocation {
  routeBase: string;
  slug: string;
  view: RuntimeView;
}

interface RuntimeShell {
  brand: {
    logoDataUri: string | null;
    name: string;
    palette: {
      accent: string;
      background: string;
      primary: string;
      secondary: string;
      surface: string;
      text: string;
    };
  };
  copy: {
    contractSummary: string;
    visualDirection: string;
  };
  labels: {
    balances: string;
    createPayment: string;
    customers: string;
    history: string;
    login: string;
    overview: string;
    payments: string;
    register: string;
  };
  routes: {
    account: string;
    balances: string;
    customers: string;
    login: string;
    metrics: string;
    paymentMethods: string;
    payments: string;
    register: string;
  };
  auth: {
    tokenResponseKey: string;
    fields: {
      currency: string;
      displayName: string;
      email: string;
      password: string;
    };
  };
  fields: {
    account: Record<string, string>;
    balance: Record<string, string>;
    customer: Record<string, string>;
    metrics: Record<string, string>;
    payment: Record<string, string>;
    paymentMethod: Record<string, string>;
    responseKeys: Record<string, string>;
  };
  ui: {
    presentation: {
      layout: string;
      density: string;
      navigationPattern: string;
      dashboardComposition: string[];
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
    };
  } | null;
}

interface RuntimeAccount {
  id: string;
  balance: number;
  currency: string;
}

interface RuntimeCustomer {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
}

interface RuntimePaymentMethod {
  id: string;
  bankName: string | null;
  brand: string | null;
  label: string;
  last4: string | null;
  type: string;
}

interface RuntimePayment {
  id: string;
  amount: number;
  createdAt: string;
  currency: string;
  customer: RuntimeCustomer | null;
  destination: string | null;
  methodType: string;
  paymentMethod: RuntimePaymentMethod | null;
  reference: string;
  status: string;
}

interface RuntimeMetrics {
  count: number;
  currency: string;
  customers: number;
  review: number;
  volume: number;
}

interface RuntimeOverview {
  account: RuntimeAccount | null;
  customers: RuntimeCustomer[];
  metrics: RuntimeMetrics;
  paymentMethods: RuntimePaymentMethod[];
  payments: RuntimePayment[];
}

type RuntimeAuthResponse = Record<string, unknown>;

declare global {
  interface Window {
    __BRAND_RUNTIME_SHELL__?: RuntimeShell;
  }
}

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
  const [shell] = useState<RuntimeShell | null>(() => window.__BRAND_RUNTIME_SHELL__ ?? null);
  const [overview, setOverview] = useState<RuntimeOverview | null>(null);
  const [status, setStatus] = useState(
    window.__BRAND_RUNTIME_SHELL__ ? "Loading seeded payment activity." : "Runtime bootstrap was not injected."
  );

  useEffect(() => {
    const onPopState = () => setLocationState(parseRuntimeLocation());

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!shell) {
      return;
    }

    refreshPayments().catch((error: unknown) => setStatus(errorMessage(error)));
  }, [shell, locationState.slug]);

  const payments = overview?.payments ?? [];
  const account = overview?.account ?? null;
  const metrics = overview?.metrics ?? metricsFromPayments(payments);

  if (!locationState.slug) {
    return <ErrorScreen message="Open a brand route like /:brandSlug/app/payments." />;
  }

  if (!shell) {
    return <ErrorScreen message={status === "" ? "Loading brand runtime." : status} />;
  }

  const shellStyle = runtimeThemeStyle(shell);
  const presentation = shell.ui?.presentation;
  const runtimeClass = `layout-${presentation?.layout ?? "sidebar-ledger"} density-${presentation?.density ?? "balanced"} nav-${presentation?.navigationPattern ?? "sidebar"}`;

  async function refreshPayments() {
    if (!shell) {
      setStatus("Runtime bootstrap was not injected.");
      return;
    }

    const paymentsResponse = await requestJson<Record<string, unknown>>(entityUrl(locationState, shell.routes.payments));
    const decodedPayments = arrayValue(paymentsResponse[responseKey(shell, "payments")] ?? paymentsResponse.payments).map((payment) =>
      decodePayment(shell, payment)
    );

    setOverview({
      account: null,
      customers: [],
      metrics: metricsFromPayments(decodedPayments),
      paymentMethods: [],
      payments: decodedPayments
    });
    setStatus("Seeded payments loaded.");
  }

  return (
    <main className={`payments-shell ${runtimeClass}`} style={shellStyle}>
      <aside className="payments-brand-rail">
        <BrandLockup shell={shell} />
        <div className="sidebar-footer">{presentation?.copyTone ?? shell.copy.contractSummary}</div>
      </aside>
      <section className="payments-main">
        <header className="topline">
          <div>
            <span className="kicker">{shell.copy.contractSummary}</span>
            <h1>{shell.labels.payments}</h1>
            <p className="subtle">{shell.copy.visualDirection}</p>
          </div>
          <span className="status">{status}</span>
        </header>
        <PaymentsExperience account={account} labels={shell.labels} metrics={metrics} payments={payments} presentation={presentation} />
      </section>
    </main>
  );
}

function BrandLockup({ shell }: { shell: RuntimeShell }) {
  return (
    <div className="brand-lockup">
      <div className="brand-mark">{shell.brand.logoDataUri ? <img alt={`${shell.brand.name} logo`} src={shell.brand.logoDataUri} /> : null}</div>
      <div>
        <strong>{shell.brand.name}</strong>
        <small>Merchant gateway</small>
      </div>
    </div>
  );
}

function Navigation({
  current,
  isOpen,
  labels,
  locationState,
  navigationPattern,
  setLocationState
}: {
  current: RuntimeView;
  isOpen: boolean;
  labels: RuntimeShell["labels"];
  locationState: RuntimeLocation;
  navigationPattern: string;
  setLocationState: (value: RuntimeLocation) => void;
}) {
  const primaryItems: Array<[RuntimeView, string]> = [
    ["dashboard", labels.overview],
    ["payments", labels.payments],
    ["customers", labels.customers],
    ["balances", labels.balances]
  ];
  const navItems = (
    <div className="nav-items">
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

  if (navigationPattern === "command-rail") {
    return (
      <details className={`nav-section nav-collapsible${isOpen ? " open" : ""}`} id="runtime-navigation" open>
        <summary>Merchant tools</summary>
        {navItems}
      </details>
    );
  }

  return (
    <nav aria-label="Merchant tools" className={`nav-section${isOpen ? " open" : ""}`} id="runtime-navigation">
      <span className="nav-label">Merchant tools</span>
      {navItems}
    </nav>
  );
}

function PaymentsExperience({
  account,
  labels,
  metrics,
  payments,
  presentation
}: {
  account: RuntimeAccount | null;
  labels: RuntimeShell["labels"];
  metrics: RuntimeMetrics;
  payments: RuntimePayment[];
  presentation: RuntimePresentation | undefined;
}) {
  const variant = presentation?.layout ?? "sidebar-ledger";

  if (variant === "compact-terminal") {
    return (
      <div className="payments-page payments-terminal">
        <section className="terminal-command">
          <MetricDeck account={account} metrics={metrics} />
        </section>
        <section className="terminal-stream panel">
          <div className="section-title">
            <h2>{labels.history}</h2>
          </div>
          <PaymentSignalList payments={payments} />
        </section>
      </div>
    );
  }

  if (variant === "command-center") {
    return (
      <div className="payments-page payments-command">
        <MetricSummary account={account} metrics={metrics} />
        <section className="command-board panel">
          <div className="section-title">
            <h2>{labels.history}</h2>
          </div>
          <PaymentSignalList payments={payments} />
        </section>
      </div>
    );
  }

  if (variant === "card-operations") {
    return (
      <div className="payments-page payments-card-wall">
        <MetricDeck account={account} metrics={metrics} />
        <section className="receipt-wall panel">
          <div className="section-title">
            <h2>{labels.payments}</h2>
          </div>
          <PaymentTiles payments={payments} />
        </section>
      </div>
    );
  }

  if (variant === "split-workspace") {
    return (
      <div className="payments-page payments-split">
        <aside className="split-rail">
          <MetricDeck account={account} metrics={metrics} />
        </aside>
        <section className="split-ledger panel">
          <div className="section-title">
            <h2>{labels.history}</h2>
          </div>
          <PaymentsTable payments={payments} />
        </section>
      </div>
    );
  }

  return (
    <div className="payments-page payments-ledger">
      <MetricSummary account={account} metrics={metrics} />
      <section className="panel">
        <div className="section-title">
          <h2>{labels.history}</h2>
        </div>
        <PaymentsTable payments={payments} />
      </section>
    </div>
  );
}

function DashboardView({
  account,
  labels,
  metrics,
  onCreatePayment,
  payments,
  presentation,
  status
}: {
  account: RuntimeAccount | null;
  labels: RuntimeShell["labels"];
  metrics: RuntimeMetrics;
  onCreatePayment: (form: HTMLFormElement) => void;
  payments: RuntimePayment[];
  presentation: RuntimePresentation | undefined;
  status: string;
}) {
  const variant = presentation?.layout ?? "sidebar-ledger";

  if (variant === "compact-terminal") {
    return (
      <TerminalDashboard
        account={account}
        labels={labels}
        metrics={metrics}
        onCreatePayment={onCreatePayment}
        payments={payments}
        status={status}
      />
    );
  }

  if (variant === "command-center") {
    return (
      <CommandCenterDashboard
        account={account}
        labels={labels}
        metrics={metrics}
        onCreatePayment={onCreatePayment}
        payments={payments}
        status={status}
      />
    );
  }

  if (variant === "card-operations") {
    return (
      <CardOperationsDashboard
        account={account}
        labels={labels}
        metrics={metrics}
        onCreatePayment={onCreatePayment}
        payments={payments}
        status={status}
      />
    );
  }

  if (variant === "split-workspace") {
    return (
      <SplitWorkspaceDashboard
        account={account}
        labels={labels}
        metrics={metrics}
        onCreatePayment={onCreatePayment}
        payments={payments}
        status={status}
      />
    );
  }

  if (variant === "topbar-console") {
    return (
      <TopbarConsoleDashboard
        account={account}
        labels={labels}
        metrics={metrics}
        onCreatePayment={onCreatePayment}
        payments={payments}
        status={status}
      />
    );
  }

  return (
    <>
      <MetricSummary account={account} metrics={metrics} />
      <div className="content-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Recent {labels.payments.toLowerCase()}</h2>
          </div>
          <PaymentsTable payments={payments.slice(0, 8)} />
        </section>
        <section className="panel">
          <div className="side-stack">
            <div className="status">{status}</div>
            <PaymentForm label={labels.createPayment} onSubmit={onCreatePayment} />
          </div>
        </section>
      </div>
    </>
  );
}

function TerminalDashboard({
  account,
  labels,
  metrics,
  onCreatePayment,
  payments,
  status
}: DashboardViewProps) {
  return (
    <div className="dashboard-terminal">
      <section className="terminal-command panel">
        <div>
          <span className="matrix-label">Live matrix</span>
          <strong>{account ? formatAmount(account.balance, account.currency) : formatAmount(0, metrics.currency)}</strong>
        </div>
        <div>
          <span>Volume</span>
          <strong>{formatAmount(metrics.volume, metrics.currency)}</strong>
        </div>
        <div>
          <span>Flow count</span>
          <strong>{metrics.count}</strong>
        </div>
        <div>
          <span>Exceptions</span>
          <strong>{metrics.review}</strong>
        </div>
      </section>
      <section className="terminal-stream panel">
        <div className="section-title">
          <h2>{labels.history}</h2>
        </div>
        <PaymentSignalList payments={payments.slice(0, 9)} />
      </section>
      <section className="terminal-bridge panel">
        <div className="status">{status}</div>
        <PaymentForm label={labels.createPayment} onSubmit={onCreatePayment} />
      </section>
    </div>
  );
}

function CommandCenterDashboard({
  account,
  labels,
  metrics,
  onCreatePayment,
  payments,
  status
}: DashboardViewProps) {
  return (
    <div className="dashboard-command">
      <section className="command-metrics panel">
        <MetricDeck account={account} metrics={metrics} />
      </section>
      <section className="command-board panel">
        <div className="section-title">
          <h2>{labels.history}</h2>
        </div>
        <PaymentSignalList payments={payments.slice(0, 8)} />
      </section>
      <section className="command-form panel">
        <div className="status">{status}</div>
        <PaymentForm label={labels.createPayment} onSubmit={onCreatePayment} />
      </section>
    </div>
  );
}

function CardOperationsDashboard({
  account,
  labels,
  metrics,
  onCreatePayment,
  payments,
  status
}: DashboardViewProps) {
  return (
    <div className="dashboard-cardops">
      <section className="payment-command panel">
        <div className="status">{status}</div>
        <PaymentForm label={labels.createPayment} onSubmit={onCreatePayment} />
      </section>
      <section className="ops-metrics">
        <MetricDeck account={account} metrics={metrics} />
      </section>
      <section className="receipt-wall panel">
        <div className="section-title">
          <h2>{labels.payments}</h2>
        </div>
        <PaymentTiles payments={payments.slice(0, 6)} />
      </section>
    </div>
  );
}

function SplitWorkspaceDashboard({
  account,
  labels,
  metrics,
  onCreatePayment,
  payments,
  status
}: DashboardViewProps) {
  return (
    <div className="dashboard-split">
      <aside className="split-rail panel">
        <MetricDeck account={account} metrics={metrics} />
      </aside>
      <section className="split-ledger panel">
        <div className="section-title">
          <h2>{labels.history}</h2>
        </div>
        <PaymentsTable payments={payments.slice(0, 10)} />
      </section>
      <section className="split-command panel">
        <div className="status">{status}</div>
        <PaymentForm label={labels.createPayment} onSubmit={onCreatePayment} />
      </section>
    </div>
  );
}

function TopbarConsoleDashboard({
  account,
  labels,
  metrics,
  onCreatePayment,
  payments,
  status
}: DashboardViewProps) {
  return (
    <div className="dashboard-topbar">
      <MetricSummary account={account} metrics={metrics} />
      <section className="console-band panel">
        <PaymentSignalList payments={payments.slice(0, 5)} />
      </section>
      <section className="console-grid">
        <div className="panel">
          <div className="section-title">
            <h2>{labels.history}</h2>
          </div>
          <PaymentsTable payments={payments.slice(0, 8)} />
        </div>
        <div className="panel">
          <div className="status">{status}</div>
          <PaymentForm label={labels.createPayment} onSubmit={onCreatePayment} />
        </div>
      </section>
    </div>
  );
}

interface DashboardViewProps {
  account: RuntimeAccount | null;
  labels: RuntimeShell["labels"];
  metrics: RuntimeMetrics;
  onCreatePayment: (form: HTMLFormElement) => void;
  payments: RuntimePayment[];
  status: string;
}

function PaymentsView({ labels, payments }: { labels: RuntimeShell["labels"]; payments: RuntimePayment[] }) {
  return (
    <section className="panel">
      <div className="section-title">
        <h2>{labels.history}</h2>
      </div>
      <PaymentsTable payments={payments} />
    </section>
  );
}

function CustomersView({
  customers,
  labels,
  methods,
  payments
}: {
  customers: RuntimeCustomer[];
  labels: RuntimeShell["labels"];
  methods: RuntimePaymentMethod[];
  payments: RuntimePayment[];
}) {
  const customerSummaries = customers.length > 0 ? customerRows(customers, payments) : customersFromPayments(payments);

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="section-title">
          <h2>{labels.customers}</h2>
        </div>
        {customerSummaries.length === 0 ? (
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
                {customerSummaries.map((customer) => (
                  <tr key={customer.name}>
                    <td>
                      <strong>{customer.name}</strong>
                      <small>{customer.instrument}</small>
                    </td>
                    <td>{customer.count}</td>
                    <td>{formatAmount(customer.volume, customer.currency)}</td>
                    <td>{customer.lastPaymentAt ? formatDateTime(customer.lastPaymentAt) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Payment sources</h2>
        </div>
        {methods.length === 0 ? (
          <div className="empty">Payment sources appear after seeded or live payments are loaded.</div>
        ) : (
          <div className="table-wrap compact-table">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Institution</th>
                </tr>
              </thead>
              <tbody>
                {methods.map((method) => (
                  <tr key={method.id}>
                    <td>
                      <strong>{method.label}</strong>
                      <small>{method.last4 ? `Ending ${method.last4}` : method.id}</small>
                    </td>
                    <td>{paymentSourceLabel(method.type)}</td>
                    <td>{method.bankName ?? method.brand ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BalancesView({ account, metrics }: { account: RuntimeAccount | null; metrics: RuntimeMetrics }) {
  return (
    <>
      <MetricSummary account={account} metrics={metrics} />
      <section className="panel account-card">
        <h2>Balance account</h2>
        <IdentityRows account={account} />
      </section>
    </>
  );
}

function MetricSummary({ account, metrics }: { account: RuntimeAccount | null; metrics: RuntimeMetrics }) {
  const balance = account ? formatAmount(account.balance, account.currency) : formatAmount(0, metrics.currency);

  return (
    <div className="summary">
      <Metric caption={account ? "Live account" : "No active account"} label="Available balance" value={balance} />
      <Metric caption="Current workspace" label="Gross volume" value={formatAmount(metrics.volume, metrics.currency)} />
      <Metric caption={`${metrics.customers} customers`} label="Payments" value={String(metrics.count)} />
      <Metric caption="Review, failed, or pending" label="Needs attention" value={String(metrics.review)} />
    </div>
  );
}

function MetricDeck({ account, metrics }: { account: RuntimeAccount | null; metrics: RuntimeMetrics }) {
  return (
    <div className="metric-deck">
      <Metric caption={account ? account.currency : metrics.currency} label="Float" value={account ? formatAmount(account.balance, account.currency) : formatAmount(0, metrics.currency)} />
      <Metric caption="Converted volume" label="Volume" value={formatAmount(metrics.volume, metrics.currency)} />
      <Metric caption={`${metrics.customers} profiles`} label="Reach" value={String(metrics.count)} />
      <Metric caption="Queued states" label="Review" value={String(metrics.review)} />
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

function AuthForm({
  labels,
  onSubmit
}: {
  labels: RuntimeShell["labels"];
  onSubmit: (mode: "login" | "register", form: HTMLFormElement) => void;
}) {
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
          {labels.register}
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
          {labels.login}
        </button>
      </div>
    </form>
  );
}

function PaymentForm({ label, onSubmit }: { label: string; onSubmit: (form: HTMLFormElement) => void }) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(event.currentTarget);
      }}
    >
      <h2>{label}</h2>
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
        {label}
      </button>
    </form>
  );
}

function PaymentsTable({ payments }: { payments: RuntimePayment[] }) {
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
            const customer = customerFromPayment(payment);

            return (
              <tr key={payment.id}>
                <td>
                  <strong>{payment.reference}</strong>
                </td>
                <td>
                  <span className={`badge ${statusClass(payment.status)}`}>{payment.status}</span>
                </td>
                <td>{formatAmount(payment.amount, payment.currency)}</td>
                <td>{customer.name}</td>
                <td>{customer.instrument}</td>
                <td>{formatDateTime(payment.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaymentSignalList({ payments }: { payments: RuntimePayment[] }) {
  if (payments.length === 0) {
    return <div className="empty">No payment activity yet.</div>;
  }

  return (
    <div className="signal-list">
      {payments.map((payment) => (
        <article className="signal-row" key={payment.id}>
          <span className={`signal-dot ${statusClass(payment.status)}`} />
          <div>
            <strong>{payment.reference}</strong>
            <small>{customerFromPayment(payment).name}</small>
          </div>
          <span>{payment.status}</span>
          <strong>{formatAmount(payment.amount, payment.currency)}</strong>
        </article>
      ))}
    </div>
  );
}

function PaymentTiles({ payments }: { payments: RuntimePayment[] }) {
  if (payments.length === 0) {
    return <div className="empty">No payment activity yet.</div>;
  }

  return (
    <div className="payment-tiles">
      {payments.map((payment) => {
        const customer = customerFromPayment(payment);

        return (
          <article className="payment-tile" key={payment.id}>
            <span className={`badge ${statusClass(payment.status)}`}>{payment.status}</span>
            <strong>{formatAmount(payment.amount, payment.currency)}</strong>
            <small>{customer.name}</small>
            <span>{payment.reference}</span>
          </article>
        );
      })}
    </div>
  );
}

function IdentityRows({ account }: { account: RuntimeAccount | null }) {
  if (!account) {
    return <div className="empty">Account details appear after sign in.</div>;
  }

  const rows: Array<[string, string | number]> = [
    ["Account", account.id],
    ["Currency", account.currency],
    ["Available", account.balance]
  ];

  return (
    <>
      {rows.map(([label, value]) => (
        <div className="identity-row" key={label}>
          <span>{label}</span>
          <strong>{label === "Available" ? formatAmount(value, account.currency) : String(value)}</strong>
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

function emptyMetrics(): RuntimeMetrics {
  return {
    count: 0,
    currency: "USD",
    customers: 0,
    review: 0,
    volume: 0
  };
}

function metricsFromPayments(payments: RuntimePayment[]): RuntimeMetrics {
  const currency = payments[0]?.currency ?? "USD";
  const customers = new Set(payments.map((payment) => payment.customer?.id ?? payment.destination ?? payment.reference));

  return {
    count: payments.length,
    currency,
    customers: customers.size,
    review: payments.filter((payment) => /failed|requires|pending|review|blocked|held/iu.test(payment.status)).length,
    volume: payments.reduce((sum, payment) => sum + payment.amount, 0)
  };
}

interface RuntimeCustomerSummary {
  count: number;
  currency: string;
  instrument: string;
  lastPaymentAt: string;
  name: string;
  volume: number;
}

function customerRows(customers: RuntimeCustomer[], payments: RuntimePayment[]): RuntimeCustomerSummary[] {
  return customers.map((customer) => {
    const customerPayments = payments.filter((payment) => payment.customer?.id === customer.id || payment.customer?.name === customer.name);
    const latestPayment = customerPayments[0];
    const volume = customerPayments.reduce((sum, payment) => sum + payment.amount, 0);

    return {
      count: customerPayments.length,
      currency: latestPayment?.currency ?? "USD",
      instrument: customer.email ?? customer.phone ?? customer.id,
      lastPaymentAt: latestPayment?.createdAt ?? "",
      name: customer.name,
      volume
    };
  });
}

function customersFromPayments(payments: RuntimePayment[]): RuntimeCustomerSummary[] {
  const customers = new Map<string, RuntimeCustomerSummary>();

  for (const payment of payments) {
    const customer = customerFromPayment(payment);
    const current = customers.get(customer.name);

    if (current) {
      current.count += 1;
      current.volume += payment.amount;
      current.lastPaymentAt = payment.createdAt;
    } else {
      customers.set(customer.name, {
        count: 1,
        currency: payment.currency,
        instrument: customer.instrument,
        lastPaymentAt: payment.createdAt,
        name: customer.name,
        volume: payment.amount
      });
    }
  }

  return [...customers.values()].sort((left, right) => right.volume - left.volume);
}

function customerFromPayment(payment: RuntimePayment) {
  const name = payment.customer?.name || payment.destination || "Customer";
  const source = payment.paymentMethod?.label || payment.paymentMethod?.last4 || payment.methodType || "Payment source";

  return {
    instrument: source,
    name
  };
}

function paymentMethodPayload(methodType: string, instrumentReference: string) {
  const last4 = instrumentSummary(instrumentReference).replace(/[^\dA-Za-z]/gu, "");

  return {
    label: `${paymentSourceLabel(methodType)} ${instrumentSummary(instrumentReference)}`,
    last4,
    type: methodType,
    ...(methodType === "card" ? { brand: cardBrand(instrumentReference) } : {}),
    ...(methodType === "bank_transfer" ? { bankName: "Demo Bank" } : {})
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

function cardBrand(value: string) {
  const compact = value.replace(/\s+/gu, "");

  if (compact.startsWith("4")) {
    return "visa";
  }

  if (compact.startsWith("5")) {
    return "mastercard";
  }

  return "card";
}

function instrumentSummary(value: string) {
  const compact = value.replace(/\s+/gu, "");

  if (compact.length <= 4) {
    return compact;
  }

  return `•••• ${compact.slice(-4)}`;
}

function runtimeThemeStyle(shell: RuntimeShell): CSSProperties {
  const theme = resolveRuntimeTheme(shell);

  return {
    "--accent": theme.accent,
    "--primary": theme.primary,
    "--secondary": theme.secondary,
    "--surface": theme.surface,
    "--text": theme.text,
    "--runtime-active-bg": theme.activeBg,
    "--runtime-bg": theme.background,
    "--runtime-border": theme.border,
    "--runtime-font": theme.fontFamily,
    "--runtime-muted": theme.muted,
    "--runtime-on-primary": theme.onPrimary,
    "--runtime-panel": theme.panel,
    "--runtime-panel-alt": theme.panelAlt,
    "--runtime-primary": theme.primary,
    "--runtime-radius": theme.radius,
    "--runtime-rail": theme.rail,
    "--runtime-secondary": theme.secondary,
    "--runtime-shadow": theme.shadow,
    "--runtime-sidebar-text": theme.sidebarText,
    "--runtime-shell-text": theme.shellText
  } as CSSProperties;
}

interface RuntimeTheme {
  accent: string;
  activeBg: string;
  background: string;
  border: string;
  fontFamily: string;
  muted: string;
  onPrimary: string;
  panel: string;
  panelAlt: string;
  primary: string;
  radius: string;
  rail: string;
  secondary: string;
  shadow: string;
  sidebarText: string;
  shellText: string;
  surface: string;
  text: string;
}

function resolveRuntimeTheme(shell: RuntimeShell): RuntimeTheme {
  const presentation = shell.ui?.presentation;
  const tokens = presentation?.visualTokens.palette ?? [];
  const colors = tokens.map(colorForToken).filter((color): color is string => Boolean(color));
  const vividColors = colors.filter((color) => !NEUTRAL_COLORS.has(color));
  const darkColor = colors.find(isDarkColor);
  const primary = vividColors.find((color) => !isDarkColor(color)) ?? vividColors[0] ?? shell.brand.palette.primary;
  const accent = vividColors.find((color) => color !== primary && !isDarkColor(color)) ?? shell.brand.palette.accent;
  const rail = darkColor ?? shell.brand.palette.secondary;
  const isDarkLayout = presentation?.layout === "command-center" || presentation?.layout === "compact-terminal";
  const surface = isDarkLayout
    ? "rgba(255, 255, 255, 0.07)"
    : colors.find((color) => color === "#ffffff" || color === "#f8fafc") ?? shell.brand.palette.surface;

  return {
    accent,
    activeBg: isDarkLayout ? "rgba(255, 255, 255, 0.12)" : `color-mix(in srgb, ${primary} 11%, ${surface})`,
    background: isDarkLayout ? rail : "#f4f7f8",
    border: isDarkLayout ? "rgba(255, 255, 255, 0.14)" : "#d8e2e8",
    fontFamily: fontStackFor(presentation?.visualTokens.typography),
    muted: isDarkLayout ? "#a9b7c2" : "#647482",
    onPrimary: "#ffffff",
    panel: surface,
    panelAlt: isDarkLayout ? "rgba(255, 255, 255, 0.08)" : "#f8fafc",
    primary,
    radius: presentation?.visualTokens.radius ?? "8px",
    rail: isDarkLayout ? rail : surface,
    secondary: darkColor ?? shell.brand.palette.secondary,
    shadow: isDarkLayout ? "0 22px 60px rgba(0, 0, 0, 0.28)" : "0 16px 42px rgba(22, 35, 48, 0.08)",
    sidebarText: isDarkLayout ? "#f8fafc" : shell.brand.palette.text,
    shellText: isDarkLayout ? "#f8fafc" : shell.brand.palette.text,
    surface,
    text: isDarkLayout ? "#f8fafc" : shell.brand.palette.text
  };
}

function colorForToken(value: string): string | null {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
  const direct = COLOR_TOKENS[normalized];

  if (direct) {
    return direct;
  }

  const match = Object.entries(COLOR_TOKENS).find(([token]) => normalized.includes(token));

  return match?.[1] ?? null;
}

function isDarkColor(color: string): boolean {
  return DARK_COLORS.has(color);
}

function fontStackFor(value: string | undefined): string {
  const normalized = value?.toLowerCase() ?? "";

  if (normalized.includes("mono-adjacent")) {
    return "\"IBM Plex Sans Condensed\", \"Aptos Narrow\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("terminal") || normalized.includes("mono")) {
    return "\"JetBrains Mono\", \"SFMono-Regular\", Consolas, \"Liberation Mono\", monospace";
  }

  if (normalized.includes("condensed") || normalized.includes("compact")) {
    return "\"IBM Plex Sans Condensed\", \"Aptos Narrow\", \"Arial Narrow\", ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("geometric") || normalized.includes("airy")) {
    return "\"Space Grotesk\", \"Avenir Next\", \"Century Gothic\", ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("humanist") || normalized.includes("retail")) {
    return "\"Source Sans 3\", Aptos, \"Segoe UI\", Frutiger, ui-sans-serif, system-ui, sans-serif";
  }

  if (normalized.includes("finance") || normalized.includes("treasury")) {
    return "Manrope, Inter, ui-sans-serif, system-ui, sans-serif";
  }

  return "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif";
}

const COLOR_TOKENS: Record<string, string> = {
  amber: "#d97706",
  black: "#020617",
  blue: "#2563eb",
  charcoal: "#111827",
  copper: "#b45309",
  cream: "#fff7ed",
  cyan: "#0891b2",
  emerald: "#059669",
  forest: "#176f52",
  graphite: "#171b1f",
  green: "#16a34a",
  ink: "#111827",
  magenta: "#be185d",
  midnight: "#101820",
  navy: "#172554",
  orange: "#ea580c",
  purple: "#6d28d9",
  "electric cyan": "#22d3ee",
  "glass violet": "#8b5cf6",
  "liquidity gold": "#f5c542",
  "matrix green": "#00ff9c",
  "cool white": "#f8fafc",
  "quartz green": "#16a34a",
  "signal green": "#22c55e",
  slate: "#334155",
  steel: "#475569",
  teal: "#0f766e",
  "tide blue": "#0e7490",
  violet: "#7c3aed",
  white: "#ffffff"
};

const DARK_COLORS = new Set(["#020617", "#101820", "#111827", "#171b1f", "#172554", "#334155", "#475569"]);
const NEUTRAL_COLORS = new Set(["#ffffff", "#f8fafc", "#020617", "#101820", "#111827", "#171b1f", "#334155", "#475569"]);

function parseRuntimeLocation(): RuntimeLocation {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const brandIndex = parts.indexOf("brands");

  if (brandIndex >= 0) {
    const slug = parts[brandIndex + 2] ?? "";
    const rawView = parts[brandIndex + 3] ?? "dashboard";

    return {
      routeBase: `/${parts.slice(0, brandIndex + 3).join("/")}`,
      slug,
      view: isRuntimeView(rawView) ? rawView : "payments"
    };
  }

  const slug = parts[0] ?? "";
  const rawView = parts[1] === "app" ? parts[2] ?? "payments" : parts[1] ?? "payments";

  return {
    routeBase: slug ? `/${slug}/app` : "",
    slug,
    view: isRuntimeView(rawView) ? rawView : "payments"
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

function entityUrl(locationState: RuntimeLocation, entity: string) {
  return `/${locationState.slug}/${entity}`;
}

function aliasPayload(fields: Record<string, string>, payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).map(([key, value]) => [fields[key] ?? key, value]));
}

function responseKey(shell: RuntimeShell, key: string): string {
  return shell.fields.responseKeys[key] ?? key;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
}

function valueAt(source: Record<string, unknown>, fields: Record<string, string>, key: string, fallback?: string): unknown {
  return source[fields[key] ?? key] ?? (fallback ? source[fallback] : undefined);
}

function decodeAccount(shell: RuntimeShell, value: unknown): RuntimeAccount | null {
  const source = objectValue(value);

  if (Object.keys(source).length === 0) {
    return null;
  }

  return {
    id: String(valueAt(source, shell.fields.account, "accountId", "id") ?? ""),
    balance: Number(valueAt(source, shell.fields.account, "balance") ?? 0),
    currency: String(valueAt(source, shell.fields.account, "currency") ?? "USD")
  };
}

function decodeCustomer(shell: RuntimeShell, value: unknown): RuntimeCustomer {
  const source = objectValue(value);

  return {
    id: String(valueAt(source, shell.fields.customer, "customerId", "id") ?? ""),
    email: nullableString(valueAt(source, shell.fields.customer, "email")),
    name: String(valueAt(source, shell.fields.customer, "name") ?? "Customer"),
    phone: nullableString(valueAt(source, shell.fields.customer, "phone"))
  };
}

function decodePaymentMethod(shell: RuntimeShell, value: unknown): RuntimePaymentMethod {
  const source = objectValue(value);

  return {
    id: String(valueAt(source, shell.fields.paymentMethod, "paymentMethodId", "id") ?? ""),
    bankName: nullableString(valueAt(source, shell.fields.paymentMethod, "bankName")),
    brand: nullableString(valueAt(source, shell.fields.paymentMethod, "brand")),
    label: String(valueAt(source, shell.fields.paymentMethod, "label") ?? "Payment source"),
    last4: nullableString(valueAt(source, shell.fields.paymentMethod, "last4")),
    type: String(valueAt(source, shell.fields.paymentMethod, "type") ?? "card")
  };
}

function decodePayment(shell: RuntimeShell, value: unknown): RuntimePayment {
  const source = objectValue(value);

  return {
    id: String(valueAt(source, shell.fields.payment, "paymentId", "id") ?? ""),
    amount: Number(valueAt(source, shell.fields.payment, "amount") ?? 0),
    createdAt: String(valueAt(source, shell.fields.payment, "createdAt") ?? new Date().toISOString()),
    currency: String(valueAt(source, shell.fields.payment, "currency") ?? "USD"),
    customer: source.customer ? decodeCustomer(shell, source.customer) : null,
    destination: nullableString(valueAt(source, shell.fields.payment, "destinationLabel", "destination")),
    methodType: String(valueAt(source, shell.fields.payment, "methodType") ?? "card"),
    paymentMethod: source.paymentMethod ? decodePaymentMethod(shell, source.paymentMethod) : null,
    reference: String(valueAt(source, shell.fields.payment, "externalReference", "reference") ?? ""),
    status: String(valueAt(source, shell.fields.payment, "status") ?? "unknown")
  };
}

function decodeMetrics(_shell: RuntimeShell, value: unknown): RuntimeMetrics {
  const source = objectValue(value);

  return {
    count: Number(source.count ?? 0),
    currency: String(source.currency ?? "USD"),
    customers: Number(source.customers ?? 0),
    review: Number(source.review ?? 0),
    volume: Number(source.volume ?? 0)
  };
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function sessionKey(locationState: RuntimeLocation) {
  return `brand-runtime-session:${locationState.slug}`;
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

function viewTitle(view: RuntimeView, shell: RuntimeShell) {
  switch (view) {
    case "payments":
      return shell.labels.payments;
    case "customers":
      return shell.labels.customers;
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
