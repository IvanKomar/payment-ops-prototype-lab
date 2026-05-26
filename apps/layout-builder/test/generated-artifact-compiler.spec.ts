import { describe, expect, it } from "vitest";

import { GeneratedArtifactCompilerService } from "../src/layouts/ai/generated-artifact-compiler.service.js";
import type { BrandRuntimeContract } from "../src/layouts/runtime/brand-runtime.types.js";

describe("GeneratedArtifactCompilerService", () => {
  it("bundles React source that imports the virtual brand SDK", async () => {
    const compiler = new GeneratedArtifactCompilerService();
    const artifact = await compiler.compile({
      source: {
        framework: "react-vite",
        entryFile: "src/App.tsx",
        routes: [
          { path: "/login", label: "Login", requiresSession: false },
          { path: "/dashboard", label: "Dashboard", requiresSession: true },
          { path: "/payments", label: "Payments", requiresSession: true }
        ],
        capabilities: ["register_user", "login_user", "read_payments", "create_payment"],
        files: [
          {
            path: "src/App.tsx",
            kind: "entry",
            content: [
              "import { createRoot } from 'react-dom/client';",
              "import { sdk } from '@brand/sdk';",
              "import './styles.css';",
              "function App() { return <main className='app'>{sdk.brand.name}</main>; }",
              "createRoot(document.getElementById('root')!).render(<App />);"
            ].join("\n")
          },
          {
            path: "src/styles.css",
            kind: "style",
            content: ".app { min-height: 100vh; }"
          }
        ]
      },
      brandId: "br_00000000000000000000000000000001",
      brandName: "Compiler Test",
      contractVersionId: "cv_00000000000000000000000000000001",
      contractSlug: "compiler-test_abcdef123456",
      facadeBasePath: "/brands/br_00000000000000000000000000000001/compiler-test_abcdef123456",
      generationProfile: {
        provider: "codex",
        model: "codex-test",
        adminPrompt: "test",
        systemPrompt: "test",
        resourceAlias: "compilerRows",
        visualDirection: "test",
        contractSummary: "test",
        statusMap: {
          created: "created",
          requires_payment_method: "requires_method",
          requires_confirmation: "requires_confirmation",
          processing: "processing",
          authorized: "authorized",
          captured: "captured",
          settled: "settled",
          failed: "failed",
          canceled: "canceled",
          refunded: "refunded"
        },
        actionLabels: {
          register: "Register",
          login: "Login",
          createPayment: "Create payment",
          history: "History",
          refund: "Refund"
        },
        generatedAt: "2026-05-26T00:00:00.000Z"
      },
      contract: contractFixture(),
      uiSpec: {} as never,
      model: "codex-test",
      sourceType: "codex-generated-artifact"
    });

    expect(artifact.files.some((file) => file.kind === "bundle" && file.content.includes("GeneratedBrandArtifact"))).toBe(true);
    expect(artifact.files.some((file) => file.path === "dist/generated-app.css")).toBe(true);
  });
});

function contractFixture(): BrandRuntimeContract {
  return {
    brandId: "br_00000000000000000000000000000001",
    brandName: "Compiler Test",
    resourceAlias: "compilerRows",
    payloadStructure: "nested",
    responseEnvelope: "resource_key",
    statusMap: {
      created: "created",
      requires_payment_method: "requires_method",
      requires_confirmation: "requires_confirmation",
      processing: "processing",
      authorized: "authorized",
      captured: "captured",
      settled: "settled",
      failed: "failed",
      canceled: "canceled",
      refunded: "refunded"
    },
    actionLabels: {
      register: "Register",
      login: "Login",
      createPayment: "Create payment",
      history: "History",
      refund: "Refund"
    },
    fields: {
      paymentId: "payment_ref",
      externalReference: "external_ref",
      paymentIntentId: "intent_ref",
      customerId: "customer_ref",
      paymentMethodId: "method_ref",
      status: "state",
      amount: "amount",
      currency: "currency",
      destinationLabel: "destination",
      methodType: "method_type",
      createdAt: "created_at"
    },
    customerFields: {
      customerId: "customer_ref",
      email: "email",
      name: "name",
      phone: "phone"
    },
    paymentMethodFields: {
      paymentMethodId: "method_ref",
      type: "type",
      label: "label",
      last4: "last4",
      brand: "brand",
      expiryMonth: "expiry_month",
      expiryYear: "expiry_year",
      bankName: "bank_name"
    },
    balanceFields: {
      balanceTransactionId: "balance_ref",
      paymentId: "payment_ref",
      type: "type",
      amount: "amount",
      currency: "currency",
      description: "description",
      createdAt: "created_at"
    },
    accountFields: {
      accountId: "account_ref",
      balance: "balance",
      currency: "currency"
    },
    userFields: {
      userId: "user_ref",
      email: "email",
      displayName: "display_name"
    },
    authFields: {
      email: "email",
      password: "password",
      displayName: "display_name",
      currency: "currency",
      sessionToken: "session_token"
    },
    responseKeys: {
      account: "account",
      metrics: "metrics",
      payments: "compilerRows",
      customers: "customers",
      paymentMethods: "paymentMethods",
      balances: "balances",
      error: "error"
    },
    endpoints: {
      account: "bff/account",
      appShell: "bff/entrypoint",
      balances: "bff/balances",
      overview: "bff/overview",
      metrics: "bff/metrics",
      register: "bff/register",
      login: "bff/login",
      payments: "bff/payments",
      customers: "bff/customers",
      paymentMethods: "bff/payment-methods",
      paymentIntents: "bff/payment-intents",
      balanceTransactions: "bff/balance-transactions",
      createCustomer: "bff/customers",
      createPaymentMethod: "bff/payment-methods",
      config: "bff/config"
    }
  };
}
