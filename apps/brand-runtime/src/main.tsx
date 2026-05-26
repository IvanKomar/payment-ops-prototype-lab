import { Fragment, StrictMode, useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createRoot } from "react-dom/client";

import "./styles.css";

type RuntimeView = "login" | "dashboard" | "payments" | "customers" | "balances";

type RuntimePresentation = NonNullable<RuntimeShell["ui"]>["presentation"];
type RuntimeAuthExperience = NonNullable<NonNullable<RuntimeShell["ui"]>["authExperience"]>;
type RuntimePaymentsExperience = NonNullable<NonNullable<RuntimeShell["ui"]>["paymentsExperience"]>;
type RuntimePaymentComposer = NonNullable<RuntimePaymentsExperience["createPayment"]>;
type RuntimePaymentTable = NonNullable<RuntimePaymentsExperience["table"]>;
type RuntimePaymentTableColumn = RuntimePaymentTable["columns"][number];

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
    authExperience?: {
      content: {
        headline: string;
        description: string;
      };
      composition?: {
        frame: "split" | "centered" | "offset" | "console" | "minimal";
        brandTreatment: "stacked" | "inline" | "badge";
        showDescription: boolean;
      };
      layout: {
        brandColumn: number;
        formMaxWidth: number;
        logoSize: number;
        panelPadding: number;
        gap: number;
        brandAlignment: "start" | "center" | "end";
        formAlignment: "start" | "center" | "end";
        textAlign: "left" | "center" | "right";
        mobileOrder: "brand-first" | "form-first";
      };
      form: {
        modeControl: "segmented" | "tabs" | "toggle";
        fieldTreatment: "boxed" | "filled" | "underlined";
        surface: "flat" | "raised" | "outlined";
        showDisplayNameOnLogin: boolean;
        fields: {
          email: { label: string; placeholder: string };
          password: { label: string; placeholder: string };
          displayName: { label: string; placeholder: string };
        };
      };
      visual: {
        background: string;
        panel: string;
        accent: string;
      };
    };
    paymentsExperience?: {
      content: {
        headline: string;
        description: string;
        emptyState: string;
      };
      composition: {
        metricsPlacement: "top" | "left" | "right" | "hidden";
        activityPattern: "table" | "cards" | "timeline";
        statusTreatment: "badge" | "rail" | "dot";
        amountEmphasis: "primary" | "secondary" | "balanced";
        showCustomer: boolean;
        showMethod: boolean;
        showTimestamp: boolean;
        maxItems: number;
      };
      layout: {
        metricsColumns: number;
        sidebarWidth: number;
        cardMinWidth: number;
        gap: number;
        panelPadding: number;
        rowMinHeight: number;
      };
      table?: {
        titlePlacement: "page" | "table" | "hidden";
        controlsPlacement: "above" | "side" | "none";
        density: "compact" | "regular" | "spacious";
        columns: Array<{
          key: "reference" | "status" | "amount" | "customer" | "method" | "createdAt" | "destination";
          label: string;
          priority: number;
        }>;
      };
      visual: {
        surface: string;
        status: string;
        dataDensity: string;
      };
      createPayment?: {
        enabled: boolean;
        placement: "intro" | "activity-top" | "activity-bottom" | "sidecar";
        surface: "compact" | "panel" | "inline";
        tone: "minimal" | "operator" | "guided";
        defaultScenario: "settle" | "review" | "reserve" | "fail";
        labels: {
          title: string;
          amount: string;
          currency: string;
          customer: string;
          customerEmail: string;
          methodType: string;
          instrument: string;
          scenario: string;
          submit: string;
        };
      };
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
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem(sessionKey(locationState)));
  const [overview, setOverview] = useState<RuntimeOverview | null>(null);
  const [status, setStatus] = useState(
    window.__BRAND_RUNTIME_SHELL__ ? "Sign in or register to open this brand workspace." : "Runtime bootstrap was not injected."
  );

  useEffect(() => {
    const onPopState = () => setLocationState(parseRuntimeLocation());

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    setSessionToken(localStorage.getItem(sessionKey(locationState)));
  }, [locationState.slug]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("sessionToken");

    if (!token) {
      return;
    }

    localStorage.setItem(sessionKey(locationState), token);
    setSessionToken(token);
    window.history.replaceState(null, "", window.location.pathname);
  }, [locationState.slug]);

  useEffect(() => {
    if (!shell || !sessionToken) {
      return;
    }

    refreshPayments(sessionToken).catch((error: unknown) => setStatus(errorMessage(error)));
  }, [shell, sessionToken, locationState.slug]);

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

  async function authenticate(mode: "login" | "register", form: HTMLFormElement) {
    if (!shell) {
      return;
    }

    const formData = new FormData(form);
    const response = await requestJson<RuntimeAuthResponse>(entityUrl(locationState, shell.routes[mode]), {
      body: JSON.stringify(aliasPayload(shell.auth.fields, {
        currency: String(formData.get("currency") ?? "USD"),
        displayName: String(formData.get("displayName") ?? `${shell.brand.name} operator`),
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? "")
      })),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    const token = String(response[shell.auth.tokenResponseKey] ?? response.sessionToken ?? "");

    if (!token) {
      throw new Error("Authentication response did not include a session token.");
    }

    localStorage.setItem(sessionKey(locationState), token);
    setSessionToken(token);
    setStatus(mode === "register" ? "Registration accepted." : "Signed in.");
    await refreshPayments(token);
  }

  async function refreshPayments(token = sessionToken) {
    if (!shell) {
      setStatus("Runtime bootstrap was not injected.");
      return;
    }

    if (!token) {
      setStatus("Sign in or register first.");
      return;
    }

    const paymentsResponse = await requestJson<unknown>(entityUrl(locationState, shell.routes.payments), {
      headers: { authorization: `Bearer ${token}` }
    });
    const decodedPayments = arrayValue(responseValue(shell, paymentsResponse, "payments")).map((payment) =>
      decodePayment(shell, payment)
    );

    setOverview({
      account: null,
      customers: [],
      metrics: metricsFromPayments(decodedPayments),
      paymentMethods: [],
      payments: decodedPayments
    });
    setStatus("Payments loaded.");
  }

  async function createPayment(form: HTMLFormElement) {
    if (!shell) {
      setStatus("Runtime bootstrap was not injected.");
      return;
    }

    if (!sessionToken) {
      setStatus("Sign in or register first.");
      return;
    }

    const formData = new FormData(form);
    const methodType = String(formData.get("methodType") ?? "card");
    await requestJson<Record<string, unknown>>(entityUrl(locationState, shell.routes.payments), {
      body: JSON.stringify({
        [shell.fields.payment.amount ?? "amount"]: Number(formData.get("amount") ?? 0),
        [shell.fields.payment.currency ?? "currency"]: String(formData.get("currency") ?? "USD"),
        [shell.fields.payment.methodType ?? "methodType"]: methodType,
        scenario: String(formData.get("scenario") ?? "settle"),
        customer: {
          [shell.fields.customer.name ?? "name"]: String(formData.get("customerName") ?? ""),
          [shell.fields.customer.email ?? "email"]: String(formData.get("customerEmail") ?? "")
        },
        paymentMethod: {
          [shell.fields.paymentMethod.type ?? "type"]: methodType,
          [shell.fields.paymentMethod.label ?? "label"]: String(formData.get("instrumentReference") ?? ""),
          [shell.fields.paymentMethod.last4 ?? "last4"]: last4(String(formData.get("instrumentReference") ?? ""))
        }
      }),
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json"
      },
      method: "POST"
    });
    form.reset();
    setStatus("Payment created.");
    await refreshPayments(sessionToken);
  }

  function logout() {
    localStorage.removeItem(sessionKey(locationState));
    setSessionToken("");
    setOverview(null);
    setStatus("Session closed.");
  }

  if (!sessionToken) {
    return (
      <AuthExperience
        presentation={presentation}
        runtimeClass={runtimeClass}
        shell={shell}
        shellStyle={shellStyle}
        status={status}
        onSubmit={(mode, form) => {
          void authenticate(mode, form).catch((error: unknown) => setStatus(errorMessage(error)));
        }}
      />
    );
  }

  return (
    <main className={`payments-shell ${runtimeClass}`} style={shellStyle}>
      <aside className="payments-brand-rail">
        <BrandLockup shell={shell} />
        <div className="sidebar-footer">{shell.labels.customers} · {shell.labels.balances}</div>
      </aside>
      <section className="payments-main">
        <header className="topline">
          <div>
            <span className="kicker">{shell.brand.name}</span>
            <h1>{shell.labels.payments}</h1>
          </div>
          <div className="top-actions">
            <span className="status">{status}</span>
            <button className="secondary" type="button" onClick={logout}>
              Sign out
            </button>
          </div>
        </header>
        <PaymentsExperience
          account={account}
          labels={shell.labels}
          metrics={metrics}
          payments={payments}
          presentation={presentation}
          shell={shell}
          onCreatePayment={(form) => {
            void createPayment(form).catch((error: unknown) => setStatus(errorMessage(error)));
          }}
        />
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
        <small>{shell.labels.overview}</small>
      </div>
    </div>
  );
}

function AuthExperience({
  onSubmit,
  presentation,
  runtimeClass,
  shell,
  shellStyle,
  status
}: {
  onSubmit: (mode: "login" | "register", form: HTMLFormElement) => void;
  presentation: RuntimePresentation | undefined;
  runtimeClass: string;
  shell: RuntimeShell;
  shellStyle: CSSProperties;
  status: string;
}) {
  const layout = presentation?.layout ?? "sidebar-ledger";
  const authExperience = authExperienceFor(shell, presentation);
  const authComposition = authCompositionFor(authExperience, layout);
  const showStatus = status !== "Sign in or register to open this brand workspace.";

  return (
    <main
      className={[
        "brand-auth-shell",
        runtimeClass,
        `auth-${layout}`,
        `auth-mode-${authExperience.form.modeControl}`,
        `auth-field-${authExperience.form.fieldTreatment}`,
        `auth-surface-${authExperience.form.surface}`,
        `auth-mobile-${authExperience.layout.mobileOrder}`,
        `auth-frame-${authComposition.frame}`,
        `auth-brand-${authComposition.brandTreatment}`,
        authComposition.showDescription ? "auth-description-on" : "auth-description-off"
      ].join(" ")}
      style={authShellStyle(shellStyle, authExperience)}
    >
      <section className="auth-identity">
        <div className="auth-brand">
          <div className="auth-brand-mark">
            {shell.brand.logoDataUri ? <img alt={`${shell.brand.name} logo`} src={shell.brand.logoDataUri} /> : null}
          </div>
          <h1>{shell.brand.name}</h1>
          {authComposition.showDescription ? <p>{authExperience.content.description}</p> : null}
        </div>
      </section>
      <section className="auth-panel">
        <AuthForm authExperience={authExperience} labels={shell.labels} shell={shell} onSubmit={onSubmit} />
        {showStatus ? <div className="status">{status}</div> : null}
      </section>
    </main>
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
  onCreatePayment,
  payments,
  presentation,
  shell
}: {
  account: RuntimeAccount | null;
  labels: RuntimeShell["labels"];
  metrics: RuntimeMetrics;
  onCreatePayment: (form: HTMLFormElement) => void;
  payments: RuntimePayment[];
  presentation: RuntimePresentation | undefined;
  shell: RuntimeShell;
}) {
  const experience = paymentsExperienceFor(shell, presentation);
  const composer = paymentComposerFor(experience, labels);
  const table = paymentTableFor(experience, labels);
  const composerPlacement = payments.length === 0 ? "activity-top" : composer.placement;
  const metricsPlacement = experience.composition.metricsPlacement;
  const activity = <GeneratedPaymentActivity experience={experience} payments={payments} table={table} />;
  const metricsBlock = metricsPlacement === "hidden" ? null : <GeneratedMetricDeck account={account} metrics={metrics} />;
  const shouldShowComposer = composer.enabled !== false || payments.length === 0;
  const composerBlock =
    shouldShowComposer ? <GeneratedPaymentComposer composer={composer} labels={labels} onSubmit={onCreatePayment} /> : null;
  const orderedBlocks =
    metricsPlacement === "right"
      ? [activity, metricsBlock]
      : metricsPlacement === "left"
        ? [metricsBlock, activity]
        : [metricsBlock, activity];

  return (
    <div
      className={[
        "payments-page",
        "payments-generated",
        `payments-metrics-${metricsPlacement}`,
        `payments-activity-${experience.composition.activityPattern}`,
        `payments-status-${experience.composition.statusTreatment}`,
        `payments-amount-${experience.composition.amountEmphasis}`,
        `payments-composer-${composerPlacement}`,
        `payments-create-${composer.surface}`,
        `payments-create-${composer.tone}`,
        `payments-table-${table.density}`,
        `payments-title-${table.titlePlacement}`,
        `payments-controls-${table.controlsPlacement}`
      ].join(" ")}
      style={paymentsExperienceStyle(experience)}
    >
      {table.titlePlacement === "page" ? <section className="payments-generated-intro">
        <div>
          <span className="kicker">{labels.payments}</span>
          <h2>{experience.content.headline}</h2>
        </div>
      </section> : null}
      {composerPlacement === "intro" ? composerBlock : null}
      {composerPlacement === "activity-top" ? composerBlock : null}
      {orderedBlocks.map((block, index) => (block ? <Fragment key={index}>{block}</Fragment> : null))}
      {composerPlacement === "activity-bottom" || composerPlacement === "sidecar" ? composerBlock : null}
    </div>
  );
}

function GeneratedPaymentComposer({
  composer,
  labels,
  onSubmit
}: {
  composer: RuntimePaymentComposer;
  labels: RuntimeShell["labels"];
  onSubmit: (form: HTMLFormElement) => void;
}) {
  return (
    <section className={`generated-payment-composer panel composer-${composer.surface} composer-${composer.tone}`}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(event.currentTarget);
        }}
      >
        <div className="composer-heading">
          <span className="kicker">{labels.createPayment}</span>
          <h2>{composer.labels.title}</h2>
        </div>
        <div className="row">
          <label>
            {composer.labels.amount}
            <input defaultValue="49.99" min="0.01" name="amount" required step="0.01" type="number" />
          </label>
          <label>
            {composer.labels.currency}
            <input defaultValue="USD" name="currency" required />
          </label>
        </div>
        <div className="row">
          <label>
            {composer.labels.customer}
            <input defaultValue="Ava Customer" name="customerName" required />
          </label>
          <label>
            {composer.labels.customerEmail}
            <input defaultValue="ava@example.com" name="customerEmail" required type="email" />
          </label>
        </div>
        <div className="row">
          <label>
            {composer.labels.methodType}
            <select defaultValue="card" name="methodType">
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="wallet">Wallet</option>
            </select>
          </label>
          <label>
            {composer.labels.instrument}
            <input defaultValue="4242 4242 4242 4242" name="instrumentReference" required />
          </label>
        </div>
        <label>
          {composer.labels.scenario}
          <select defaultValue={composer.defaultScenario} name="scenario">
            <option value="settle">Authorize and capture</option>
            <option value="review">Hold for review</option>
            <option value="reserve">Reserve funds</option>
            <option value="fail">Decline</option>
          </select>
        </label>
        <button className="primary" type="submit">
          {composer.labels.submit}
        </button>
      </form>
    </section>
  );
}

function GeneratedMetricDeck({
  account,
  metrics
}: {
  account: RuntimeAccount | null;
  metrics: RuntimeMetrics;
}) {
  const balance = account ? formatAmount(account.balance, account.currency) : formatAmount(0, metrics.currency);

  return (
    <section className="generated-metrics panel">
      <Metric caption={account ? account.currency : metrics.currency} label="Available" value={balance} />
      <Metric caption="Gross flow" label="Volume" value={formatAmount(metrics.volume, metrics.currency)} />
      <Metric caption={`${metrics.customers} profiles`} label="Count" value={String(metrics.count)} />
      <Metric caption="Review queue" label="Attention" value={String(metrics.review)} />
    </section>
  );
}

function GeneratedPaymentActivity({
  experience,
  payments,
  table
}: {
  experience: RuntimePaymentsExperience;
  payments: RuntimePayment[];
  table: RuntimePaymentTable;
}) {
  const visiblePayments = payments.slice(0, experience.composition.maxItems);
  const sortedColumns = [...table.columns].sort((left, right) => left.priority - right.priority);

  if (visiblePayments.length === 0) {
    return (
      <section className="generated-activity panel">
        {table.titlePlacement === "table" ? <GeneratedTableHeading count={0} experience={experience} /> : null}
        <div className="generated-table-wrap is-empty">
          <table aria-label={experience.content.headline}>
            <thead>
              <tr>
                {sortedColumns.map((column) => (
                  <th data-column={column.key} key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="generated-empty-cell" colSpan={sortedColumns.length}>
                  {experience.content.emptyState}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  return (
    <section className="generated-activity panel">
      {table.titlePlacement === "table" ? <GeneratedTableHeading count={visiblePayments.length} experience={experience} /> : null}
      <div className="generated-table-wrap">
        <table aria-label={experience.content.headline}>
          <thead>
            <tr>
              {sortedColumns.map((column) => (
                <th data-column={column.key} key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiblePayments.map((payment) => (
              <tr key={payment.id}>
                {sortedColumns.map((column) => (
                  <td data-column={column.key} key={column.key}>{paymentTableCell(column, payment, experience)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GeneratedTableHeading({ count, experience }: { count: number; experience: RuntimePaymentsExperience }) {
  return (
    <div className="generated-table-heading">
      <h2>{experience.content.headline}</h2>
      <span className="generated-table-count">{count} records</span>
    </div>
  );
}

function paymentTableCell(column: RuntimePaymentTableColumn, payment: RuntimePayment, experience: RuntimePaymentsExperience): ReactNode {
  const customer = customerFromPayment(payment);

  if (column.key === "status") {
    return (
      <span className={`generated-status ${statusClass(payment.status)}`}>
        {payment.status}
      </span>
    );
  }

  if (column.key === "amount") {
    return <strong className="generated-payment-amount">{formatAmount(payment.amount, payment.currency)}</strong>;
  }

  if (column.key === "customer") {
    return <span>{customer.name}</span>;
  }

  if (column.key === "method") {
    return <span>{customer.instrument}</span>;
  }

  if (column.key === "createdAt") {
    return <span>{formatDateTime(payment.createdAt)}</span>;
  }

  if (column.key === "destination") {
    return <span>{payment.destination || customer.name}</span>;
  }

  return (
    <span className="generated-reference-cell">
      <strong>{payment.reference}</strong>
      {experience.composition.showCustomer ? <small>{customer.name}</small> : null}
    </span>
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
  authExperience,
  labels,
  shell,
  onSubmit
}: {
  authExperience: RuntimeAuthExperience;
  labels: RuntimeShell["labels"];
  shell: RuntimeShell;
  onSubmit: (mode: "login" | "register", form: HTMLFormElement) => void;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const isRegister = mode === "register";
  const showDisplayName = isRegister || authExperience.form.showDisplayNameOnLogin;

  return (
    <form
      aria-label={`${shell.brand.name} ${isRegister ? labels.register : labels.login}`}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(mode, event.currentTarget);
      }}
    >
      <div className="auth-mode-switch" role="group" aria-label="Choose authentication mode">
        <button aria-pressed={mode === "login"} className={mode === "login" ? "active" : ""} type="button" onClick={() => setMode("login")}>
          {labels.login}
        </button>
        <button aria-pressed={mode === "register"} className={mode === "register" ? "active" : ""} type="button" onClick={() => setMode("register")}>
          {labels.register}
        </button>
      </div>
      <label>
        {authExperience.form.fields.email.label}
        <input
          autoComplete={isRegister ? "email" : "username"}
          defaultValue="client@example.com"
          inputMode="email"
          name="email"
          placeholder={authExperience.form.fields.email.placeholder}
          required
          type="email"
        />
      </label>
      <label>
        {authExperience.form.fields.password.label}
        <input
          autoComplete={isRegister ? "new-password" : "current-password"}
          defaultValue="local-demo-password"
          minLength={8}
          name="password"
          placeholder={authExperience.form.fields.password.placeholder}
          required
          type="password"
        />
      </label>
      {showDisplayName ? (
        <label>
          {authExperience.form.fields.displayName.label}
          <input
            autoComplete="name"
            defaultValue={`${shell.brand.name} Operator`}
            name="displayName"
            placeholder={authExperience.form.fields.displayName.placeholder}
          />
        </label>
      ) : (
        <input name="displayName" type="hidden" value={`${shell.brand.name} Operator`} />
      )}
      <input name="currency" type="hidden" value="USD" />
      <div className="button-row">
        <button className="primary" type="submit">
          {isRegister ? labels.register : labels.login}
        </button>
      </div>
    </form>
  );
}

function authExperienceFor(shell: RuntimeShell, presentation: RuntimePresentation | undefined): RuntimeAuthExperience {
  return shell.ui?.authExperience ?? {
    content: {
      headline: shell.brand.name,
      description: shell.copy.visualDirection || shell.copy.contractSummary || "Secure access for this brand workspace."
    },
    composition: {
      frame: presentation?.layout === "compact-terminal" ? "console" : presentation?.layout === "command-center" ? "centered" : "split",
      brandTreatment: presentation?.layout === "topbar-console" ? "inline" : "stacked",
      showDescription: presentation?.layout !== "compact-terminal"
    },
    layout: {
      brandColumn: 50,
      formMaxWidth: 420,
      logoSize: 76,
      panelPadding: 18,
      gap: 24,
      brandAlignment: presentation?.layout === "command-center" ? "center" : "start",
      formAlignment: "center",
      textAlign: presentation?.layout === "command-center" ? "center" : "left",
      mobileOrder: "brand-first"
    },
    form: {
      modeControl: "segmented",
      fieldTreatment: "boxed",
      surface: "raised",
      showDisplayNameOnLogin: false,
      fields: {
        email: { label: "Email", placeholder: "client@example.com" },
        password: { label: "Password", placeholder: "local-demo-password" },
        displayName: { label: "Display name", placeholder: `${shell.brand.name} operator` }
      }
    },
    visual: {
      background: presentation?.visualTokens.surfaces ?? "brand access shell",
      panel: presentation?.visualTokens.buttons ?? "focused access panel",
      accent: presentation?.copyTone ?? "secure brand access"
    }
  };
}

function authCompositionFor(authExperience: RuntimeAuthExperience, layout: string) {
  return {
    frame:
      authExperience.composition?.frame ??
      (layout === "compact-terminal" ? "console" : layout === "command-center" ? "centered" : "split"),
    brandTreatment: authExperience.composition?.brandTreatment ?? (layout === "topbar-console" ? "inline" : "stacked"),
    showDescription: authExperience.composition?.showDescription ?? layout !== "compact-terminal"
  };
}

function paymentsExperienceFor(shell: RuntimeShell, presentation: RuntimePresentation | undefined): RuntimePaymentsExperience {
  const fallbackTable = defaultPaymentTable(shell.labels, presentation);
  const fallback: RuntimePaymentsExperience = {
    content: {
      headline: shell.labels.payments,
      description: shell.copy.visualDirection || shell.copy.contractSummary || "Seeded payment activity for this brand workspace.",
      emptyState: "No payment activity yet."
    },
    composition: {
      metricsPlacement: presentation?.layout === "split-workspace" ? "left" : "top",
      activityPattern: "table",
      statusTreatment: presentation?.layout === "compact-terminal" ? "dot" : presentation?.layout === "card-operations" ? "rail" : "badge",
      amountEmphasis: "balanced",
      showCustomer: true,
      showMethod: true,
      showTimestamp: true,
      maxItems: 10
    },
    layout: {
      metricsColumns: presentation?.layout === "topbar-console" ? 4 : 3,
      sidebarWidth: 280,
      cardMinWidth: 240,
      gap: 16,
      panelPadding: 16,
      rowMinHeight: 64
    },
    table: fallbackTable,
    visual: {
      surface: presentation?.visualTokens.surfaces ?? "brand payment surface",
      status: presentation?.visualTokens.buttons ?? "clear status treatment",
      dataDensity: presentation?.visualTokens.spacing ?? "balanced payment density"
    },
    createPayment: defaultPaymentComposer(shell.labels)
  };

  const input = shell.ui?.paymentsExperience;

  if (!input) {
    return fallback;
  }

  const fallbackComposer = fallback.createPayment ?? defaultPaymentComposer(shell.labels);
  const inputTable = input.table ?? fallbackTable;

  return {
    content: { ...fallback.content, ...input.content },
    composition: { ...fallback.composition, ...input.composition },
    layout: { ...fallback.layout, ...input.layout },
    table: {
      ...fallbackTable,
      ...inputTable,
      columns: inputTable.columns && inputTable.columns.length > 0 ? inputTable.columns : fallbackTable.columns
    },
    visual: { ...fallback.visual, ...input.visual },
    createPayment: {
      enabled: input.createPayment?.enabled ?? fallbackComposer.enabled,
      placement: input.createPayment?.placement ?? fallbackComposer.placement,
      surface: input.createPayment?.surface ?? fallbackComposer.surface,
      tone: input.createPayment?.tone ?? fallbackComposer.tone,
      defaultScenario: input.createPayment?.defaultScenario ?? fallbackComposer.defaultScenario,
      labels: {
        ...fallbackComposer.labels,
        ...input.createPayment?.labels
      }
    }
  };
}

function paymentTableFor(experience: RuntimePaymentsExperience, labels: RuntimeShell["labels"]): RuntimePaymentTable {
  const fallback = defaultPaymentTable(labels, undefined);
  const source = experience.table ?? fallback;
  const columns = source.columns.length >= 4 ? source.columns : fallback.columns;

  return {
    ...fallback,
    ...source,
    columns: normalizeRuntimeColumns(columns, fallback.columns)
  };
}

function normalizeRuntimeColumns(
  columns: RuntimePaymentTable["columns"],
  fallback: RuntimePaymentTable["columns"]
): RuntimePaymentTable["columns"] {
  const allowed = new Set(["reference", "status", "amount", "customer", "method", "createdAt", "destination"]);
  const deduped: RuntimePaymentTable["columns"] = [];

  for (const column of columns) {
    if (allowed.has(column.key) && !deduped.some((existing) => existing.key === column.key)) {
      deduped.push(column);
    }
  }

  for (const column of fallback.slice(0, 3)) {
    if (!deduped.some((existing) => existing.key === column.key)) {
      deduped.unshift(column);
    }
  }

  return deduped.slice(0, 7).map((column, index) => ({ ...column, priority: index + 1 }));
}

function defaultPaymentTable(labels: RuntimeShell["labels"], presentation: RuntimePresentation | undefined): RuntimePaymentTable {
  const isCompact = presentation?.layout === "compact-terminal" || presentation?.density === "compact";

  return {
    titlePlacement: presentation?.layout === "topbar-console" || presentation?.layout === "compact-terminal" ? "hidden" : "table",
    controlsPlacement: presentation?.layout === "split-workspace" || presentation?.layout === "card-operations" ? "side" : "above",
    density: isCompact ? "compact" : presentation?.density === "spacious" ? "spacious" : "regular",
    columns: [
      { key: "reference", label: labels.payments, priority: 1 },
      { key: "status", label: "State", priority: 2 },
      { key: "amount", label: "Amount", priority: 3 },
      { key: "customer", label: "Customer", priority: 4 },
      { key: "method", label: "Source", priority: 5 },
      { key: "createdAt", label: "Created", priority: 6 }
    ]
  };
}

function paymentComposerFor(experience: RuntimePaymentsExperience, labels: RuntimeShell["labels"]): RuntimePaymentComposer {
  const fallback = defaultPaymentComposer(labels);

  return {
    ...fallback,
    ...experience.createPayment,
    labels: {
      ...fallback.labels,
      ...experience.createPayment?.labels
    }
  };
}

function defaultPaymentComposer(labels: RuntimeShell["labels"]): RuntimePaymentComposer {
  return {
    enabled: true,
    placement: "activity-top",
    surface: "panel",
    tone: "operator",
    defaultScenario: "settle",
    labels: {
      title: labels.createPayment,
      amount: "Amount",
      currency: "Currency",
      customer: "Customer",
      customerEmail: "Customer email",
      methodType: "Payment source",
      instrument: "Card or account",
      scenario: "Processing route",
      submit: labels.createPayment
    }
  };
}

function authShellStyle(shellStyle: CSSProperties, authExperience: RuntimeAuthExperience): CSSProperties {
  const brandColumn = Math.min(70, Math.max(30, authExperience.layout.brandColumn));
  const formColumn = 100 - brandColumn;

  return {
    ...shellStyle,
    "--auth-brand-column": `${brandColumn}fr`,
    "--auth-form-column": `${formColumn}fr`,
    "--auth-form-max": `${authExperience.layout.formMaxWidth}px`,
    "--auth-logo-size": `${authExperience.layout.logoSize}px`,
    "--auth-panel-padding": `${authExperience.layout.panelPadding}px`,
    "--auth-gap": `${authExperience.layout.gap}px`,
    "--auth-brand-align": authExperience.layout.brandAlignment,
    "--auth-form-align": authExperience.layout.formAlignment,
    "--auth-text-align": authExperience.layout.textAlign
  } as CSSProperties;
}

function paymentsExperienceStyle(experience: RuntimePaymentsExperience): CSSProperties {
  return {
    "--payments-metrics-columns": experience.layout.metricsColumns,
    "--payments-sidebar-width": `${experience.layout.sidebarWidth}px`,
    "--payments-card-min": `${experience.layout.cardMinWidth}px`,
    "--payments-gap": `${experience.layout.gap}px`,
    "--payments-panel-padding": `${experience.layout.panelPadding}px`,
    "--payments-row-min": `${experience.layout.rowMinHeight}px`
  } as CSSProperties;
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
  const saturatedColors = vividColors.filter((color) => !isDarkColor(color) && !isLightColor(color));
  const primary = saturatedColors[0] ?? vividColors.find((color) => !isDarkColor(color)) ?? shell.brand.palette.primary;
  const accent = saturatedColors.find((color) => color !== primary) ?? shell.brand.palette.accent;
  const rail = darkColor ?? shell.brand.palette.secondary;
  const isDarkLayout = presentation?.layout === "command-center" || presentation?.layout === "compact-terminal";
  const lightColor = colors.find((color) => isLightColor(color) && color !== "#ffffff");
  const surface = isDarkLayout
    ? "rgba(255, 255, 255, 0.07)"
    : colors.find((color) => color === "#ffffff" || color === "#f8fafc") ?? shell.brand.palette.surface;
  const shellText = isDarkLayout ? "#f8fafc" : shell.brand.palette.text;

  return {
    accent,
    activeBg: isDarkLayout ? "rgba(255, 255, 255, 0.12)" : `color-mix(in srgb, ${primary} 11%, ${surface})`,
    background: isDarkLayout ? rail : lightColor ?? "#f4f7f8",
    border: isDarkLayout ? "rgba(255, 255, 255, 0.14)" : "#d8e2e8",
    fontFamily: fontStackFor(presentation?.visualTokens.typography),
    muted: isDarkLayout ? "#a9b7c2" : "#647482",
    onPrimary: "#ffffff",
    panel: surface,
    panelAlt: isDarkLayout ? "rgba(255, 255, 255, 0.08)" : "#f8fafc",
    primary,
    radius: presentation?.visualTokens.radius ?? "8px",
    rail,
    secondary: darkColor ?? shell.brand.palette.secondary,
    shadow: isDarkLayout ? "0 22px 60px rgba(0, 0, 0, 0.28)" : "0 16px 42px rgba(22, 35, 48, 0.08)",
    sidebarText: isDarkColor(rail) ? "#f8fafc" : shellText,
    shellText,
    surface,
    text: isDarkLayout ? "#f8fafc" : shell.brand.palette.text
  };
}

function colorForToken(value: string): string | null {
  const raw = value.trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/u.test(raw)) {
    return raw;
  }

  if (/^#[0-9a-f]{3}$/u.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }

  const normalized = raw.replace(/[^a-z0-9]+/gu, " ").trim();
  const direct = COLOR_TOKENS[normalized];

  if (direct) {
    return direct;
  }

  const match = Object.entries(COLOR_TOKENS).find(([token]) => normalized.includes(token));

  return match?.[1] ?? null;
}

function isDarkColor(color: string): boolean {
  if (DARK_COLORS.has(color)) {
    return true;
  }

  const rgb = hexToRgb(color);

  if (!rgb) {
    return false;
  }

  return relativeLuminance(rgb) < 0.22;
}

function isLightColor(color: string): boolean {
  const rgb = hexToRgb(color);

  return rgb ? relativeLuminance(rgb) > 0.82 : color === "#ffffff" || color === "#f8fafc";
}

function hexToRgb(color: string): { r: number; g: number; b: number } | null {
  const normalized = color.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/u.exec(normalized);

  if (!match) {
    return null;
  }

  const value = match[1]!;

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const normalized = channel / 255;

    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
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
  lime: "#a3e635",
  magenta: "#be185d",
  midnight: "#101820",
  navy: "#172554",
  orange: "#ea580c",
  purple: "#6d28d9",
  "electric cyan": "#22d3ee",
  "glass violet": "#8b5cf6",
  "liquidity gold": "#f5c542",
  "matrix green": "#00ff9c",
  "acid lime": "#84cc16",
  "cool white": "#f8fafc",
  "quartz green": "#16a34a",
  "signal amber": "#f59e0b",
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

function responseValue(shell: RuntimeShell, payload: unknown, key: string): unknown {
  const wantedKey = responseKey(shell, key);
  const source = objectValueOrNull(payload);

  if (!source) {
    return payload;
  }

  const direct = source[wantedKey] ?? source[key];

  if (direct !== undefined) {
    return direct;
  }

  const data = source.data;

  if (data !== undefined) {
    return responseValue(shell, data, key);
  }

  const result = source.result;

  if (result !== undefined) {
    return responseValue(shell, result, key);
  }

  return undefined;
}

function last4(value: string): string {
  return value.replace(/\D/g, "").slice(-4);
}

function objectValueOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function objectValue(value: unknown): Record<string, unknown> {
  return objectValueOrNull(value) ?? {};
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)) : [];
}

function valueAt(source: Record<string, unknown>, fields: Record<string, string>, key: string, fallback?: string): unknown {
  return source[fields[key] ?? key] ?? (fallback ? source[fallback] : undefined);
}

function relationValue(shell: RuntimeShell, source: Record<string, unknown>, responseKeyName: "customers" | "paymentMethods", fallback: string): unknown {
  const pluralKey = responseKey(shell, responseKeyName);
  const singularKey = singularAlias(pluralKey);

  return source[fallback] ?? source[singularKey] ?? source[pluralKey];
}

function singularAlias(value: string): string {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s")) {
    return value.slice(0, -1);
  }

  return value;
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
    customer: relationValue(shell, source, "customers", "customer") ? decodeCustomer(shell, relationValue(shell, source, "customers", "customer")) : null,
    destination: nullableString(valueAt(source, shell.fields.payment, "destinationLabel", "destination")),
    methodType: String(valueAt(source, shell.fields.payment, "methodType") ?? "card"),
    paymentMethod: relationValue(shell, source, "paymentMethods", "paymentMethod") ? decodePaymentMethod(shell, relationValue(shell, source, "paymentMethods", "paymentMethod")) : null,
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
