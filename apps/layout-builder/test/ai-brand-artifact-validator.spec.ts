import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { LayoutBuilderGeneratedBrandArtifact } from "@payment-ops/shared-types";

import { AiBrandArtifactValidatorService } from "../src/layouts/ai/ai-brand-artifact-validator.service.js";
import type { BrandRuntimeContract } from "../src/layouts/runtime/brand-runtime.types.js";

const validator = new AiBrandArtifactValidatorService();
const brandId = "br_00000000000000000000000000000001";
const contractVersionId = "cv_00000000000000000000000000000001";
const slug = "nova_123456abcdef";

describe("AiBrandArtifactValidatorService", () => {
  it("returns a passed artifact when the manifest uses only BFF aliases", () => {
    const artifact = validator.validate({
      artifact: artifactFixture(),
      brandId,
      contractVersionId,
      slug,
      contract: contractFixture()
    });

    expect(artifact.validation.status).toBe("passed");
    expect(artifact.validation.checks).toContain("network calls are restricted to generated BFF aliases");
  });

  it("rejects generated sources that expose internal platform details", () => {
    expect(() =>
      validator.validate({
        artifact: artifactFixture({
          files: [
            ...artifactFixture().files,
            {
              path: "src/leak.ts",
              kind: "component",
              bytes: 42,
              content: "fetch('/runtime/admin/resources'); // payment-core"
            }
          ]
        }),
        brandId,
        contractVersionId,
        slug,
        contract: contractFixture()
      })
    ).toThrow(BadRequestException);
  });

  it("rejects generated contracts with direct runtime endpoints", () => {
    expect(() =>
      validator.validate({
        artifact: artifactFixture(),
        brandId,
        contractVersionId,
        slug,
        contract: contractFixture({
          payments: "runtime/payments"
        })
      })
    ).toThrow(BadRequestException);
  });
});

function artifactFixture(
  overrides: Partial<LayoutBuilderGeneratedBrandArtifact> = {}
): LayoutBuilderGeneratedBrandArtifact {
  return {
    artifactId: "art_00000000000000000000000000000001",
    brandId,
    provider: "local",
    model: "local-brand-runtime-v1",
    sourceType: "ai-spec",
    status: "active",
    framework: "react-vite",
    entryFile: "src/App.tsx",
    contractVersionId,
    facadeBasePath: `/brands/${brandId}/${slug}`,
    uiSpec: {
      labels: {
        register: "Register",
        login: "Login",
        createPayment: "Create payment",
        history: "History",
        refund: "Refund",
        overview: "Overview",
        payments: "Payments",
        customers: "Customers",
        balances: "Balances"
      },
      navigation: { dashboard: "Dashboard", payments: "Payments", customers: "Customers", balances: "Balances" },
      tableLabels: { id: "ID", status: "Status", amount: "Amount", customer: "Customer", createdAt: "Created" },
      formLabels: { amount: "Amount", customer: "Customer", method: "Method" },
      presentation: {
        layout: "sidebar-ledger",
        density: "balanced",
        navigationPattern: "sidebar",
        dashboardComposition: ["metrics", "recentPayments", "balances"],
        visualTokens: {
          palette: ["white", "blue", "slate"],
          typography: "system sans",
          radius: "8px",
          spacing: "balanced",
          surfaces: "white panels",
          buttons: "solid primary"
        },
        copyTone: "merchant operations",
        componentLabels: { metricsCard: "Overview", paymentTable: "Payments", createPanel: "Create" },
        emptyStates: { payments: "No payments.", customers: "No customers.", balances: "No balances." }
      }
    },
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
        bytes: 32,
        content: "export function App() { return null; }"
      },
      {
        path: "src/contract.ts",
        kind: "contract",
        bytes: 24,
        content: "export const endpoints = {};"
      }
    ],
    validation: {
      status: "passed",
      checks: []
    },
    generatedAt: "2026-05-22T00:00:00.000Z",
    ...overrides
  };
}

function contractFixture(endpoints: Partial<BrandRuntimeContract["endpoints"]> = {}): BrandRuntimeContract {
  return {
    brandId,
    brandName: "Nova",
    resourceAlias: "settlementCases",
    statusMap: {
      created: "created",
      requires_payment_method: "requiresMethod",
      requires_confirmation: "requiresConfirmation",
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
      paymentId: "paymentId",
      externalReference: "externalReference",
      paymentIntentId: "paymentIntentId",
      customerId: "customerId",
      paymentMethodId: "paymentMethodId",
      status: "status",
      amount: "amount",
      currency: "currency",
      destinationLabel: "destinationLabel",
      methodType: "methodType",
      createdAt: "createdAt"
    },
    customerFields: {
      customerId: "customerId",
      email: "email",
      name: "name",
      phone: "phone"
    },
    paymentMethodFields: {
      paymentMethodId: "paymentMethodId",
      type: "type",
      label: "label",
      last4: "last4",
      brand: "brand",
      expiryMonth: "expiryMonth",
      expiryYear: "expiryYear",
      bankName: "bankName"
    },
    balanceFields: {
      balanceTransactionId: "balanceTransactionId",
      paymentId: "paymentId",
      type: "type",
      amount: "amount",
      currency: "currency",
      description: "description",
      createdAt: "createdAt"
    },
    accountFields: {
      accountId: "accountId",
      balance: "balance",
      currency: "currency"
    },
    userFields: {
      userId: "userId",
      email: "email",
      displayName: "displayName"
    },
    authFields: {
      email: "email",
      password: "password",
      displayName: "displayName",
      currency: "currency",
      sessionToken: "sessionToken"
    },
    responseKeys: {
      account: "account",
      metrics: "metrics",
      payments: "payments",
      customers: "customers",
      paymentMethods: "paymentMethods",
      balances: "balances",
      error: "error"
    },
    endpoints: {
      account: "bff/workspace",
      appShell: "bff/workspace-entry",
      balances: "bff/treasury",
      metrics: "bff/signals",
      overview: "bff/workspace-summary",
      register: "bff/access-open",
      login: "bff/access-resume",
      payments: "bff/settlement-cases",
      customers: "bff/profiles",
      paymentMethods: "bff/funding-keys",
      paymentIntents: "bff/routing-drafts",
      balanceTransactions: "bff/ledger-moves",
      createCustomer: "bff/profiles",
      createPaymentMethod: "bff/funding-keys",
      config: "bff/interface",
      ...endpoints
    }
  };
}
