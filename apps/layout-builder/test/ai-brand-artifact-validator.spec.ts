import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import type { LayoutBuilderGeneratedBrandArtifact } from "@payment-ops/shared-types";

import { AiBrandArtifactValidatorService } from "../src/layouts/ai/ai-brand-artifact-validator.service.js";
import { toRuntimeEntityResponse } from "../src/layouts/runtime/brand-runtime.types.js";
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

  it("applies generated runtime response envelopes to public entity data", () => {
    const payload = [{ paymentId: "PM-1" }];

    expect(toRuntimeEntityResponse({ ...contractFixture(), responseEnvelope: "plain" }, "payments", payload)).toEqual(payload);
    expect(toRuntimeEntityResponse({ ...contractFixture(), responseEnvelope: "data" }, "payments", payload)).toEqual({
      data: payload,
      meta: { count: 1, resource: "payments" }
    });
    expect(toRuntimeEntityResponse({ ...contractFixture(), responseEnvelope: "result" }, "payments", payload)).toEqual({
      ok: true,
      result: { count: 1, payments: payload, resource: "payments" }
    });
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
      authExperience: {
        content: { headline: "Test Brand", description: "Secure access for the generated brand." },
        composition: {
          frame: "split",
          brandTreatment: "stacked",
          showDescription: true
        },
        layout: {
          brandColumn: 50,
          formMaxWidth: 420,
          logoSize: 76,
          panelPadding: 18,
          gap: 24,
          brandAlignment: "start",
          formAlignment: "center",
          textAlign: "left",
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
            displayName: { label: "Display name", placeholder: "Test operator" }
          }
        },
        visual: {
          background: "test shell",
          panel: "test panel",
          accent: "test accent"
        }
      },
      paymentsExperience: {
        content: {
          headline: "Payments",
          description: "Seeded payment activity for validation.",
          emptyState: "No payments."
        },
        composition: {
          metricsPlacement: "top",
          activityPattern: "table",
          statusTreatment: "badge",
          amountEmphasis: "balanced",
          showCustomer: true,
          showMethod: true,
          showTimestamp: true,
          maxItems: 10
        },
        layout: {
          metricsColumns: 3,
          sidebarWidth: 280,
          cardMinWidth: 240,
          gap: 16,
          panelPadding: 16,
          rowMinHeight: 64
        },
        table: {
          titlePlacement: "table",
          controlsPlacement: "above",
          density: "regular",
          columns: [
            { key: "reference", label: "Payment", priority: 1 },
            { key: "status", label: "State", priority: 2 },
            { key: "amount", label: "Amount", priority: 3 },
            { key: "customer", label: "Customer", priority: 4 },
            { key: "createdAt", label: "Created", priority: 5 }
          ]
        },
        visual: {
          surface: "test surface",
          status: "test status",
          dataDensity: "test density"
        },
        createPayment: {
          enabled: true,
          placement: "activity-top",
          surface: "panel",
          tone: "operator",
          defaultScenario: "settle",
          labels: {
            title: "Create payment",
            amount: "Amount",
            currency: "Currency",
            customer: "Customer",
            customerEmail: "Customer email",
            methodType: "Payment source",
            instrument: "Card or account",
            scenario: "Processing route",
            submit: "Create payment"
          }
        }
      },
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
    payloadStructure: "nested",
    responseEnvelope: "resource_key",
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
