import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAgentManifest,
  LayoutBuilderAiBrandSpec
} from "@payment-ops/shared-types";

import {
  AI_DASHBOARD_BLOCKS,
  AI_UI_DENSITIES,
  AI_UI_LAYOUTS,
  AI_UI_NAVIGATION_PATTERNS,
  PAYMENT_STATUSES,
  RESERVED_PUBLIC_ROUTES
} from "./ai-brand-spec.service.js";
import { BRAND_SPEC_UNIQUENESS_THRESHOLD } from "./brand-spec-uniqueness.service.js";

@Injectable()
export class AiAgentManifestService {
  getManifest(): LayoutBuilderAgentManifest {
    const spec = exampleSpec();

    return {
      manifestVersion: "2026-05-24.ai-brand-agent.v1",
      purpose: "Machine-readable contract for external AI agents that generate payment brand specs through the Layout Builder API.",
      flows: ["managed_draft", "external_spec_import", "direct_create_from_spec"],
      endpoints: [
        {
          method: "GET",
          path: "/brands/ai/agent-manifest",
          authRequired: false,
          contentType: "application/json",
          purpose: "Read schemas, validation rules, examples, and safe integration instructions."
        },
        {
          method: "POST",
          path: "/brands/ai/drafts",
          authRequired: true,
          contentType: "application/json",
          purpose: "Managed chat flow. Backend calls the configured AI provider and stores a draft spec."
        },
        {
          method: "POST",
          path: "/brands/ai/drafts/:draftId/messages",
          authRequired: true,
          contentType: "application/json",
          purpose: "Append a follow-up chat message and regenerate a managed draft."
        },
        {
          method: "GET",
          path: "/brands/ai/drafts/:draftId",
          authRequired: true,
          contentType: "application/json",
          purpose: "Read draft spec, validation issues, and status."
        },
        {
          method: "POST",
          path: "/brands/ai/drafts/:draftId/create",
          authRequired: true,
          contentType: "multipart/form-data",
          purpose: "Create a brand from an approved draft. Requires logo file."
        },
        {
          method: "POST",
          path: "/brands/ai/drafts/from-spec",
          authRequired: true,
          contentType: "application/json",
          purpose: "External-agent flow. Submit a complete AI-authored spec without backend LLM calls."
        },
        {
          method: "POST",
          path: "/brands/ai/drafts/from-spec/create",
          authRequired: true,
          contentType: "multipart/form-data",
          purpose: "External-agent direct create. Submit logo plus JSON payload containing a complete spec."
        }
      ],
      schemas: {
        aiBrandSpec: aiBrandSpecJsonSchema(),
        createBrandDraftRequest: createBrandDraftJsonSchema(),
        createBrandDraftFromSpecRequest: createBrandDraftFromSpecJsonSchema()
      },
      allowedEnums: {
        providers: ["local", "openai", "gemini", "anthropic", "codex"],
        payloadStructures: ["flat", "nested", "key-value-array"],
        fieldStyles: ["camelCase", "snake_case", "kebab-case"],
        responseEnvelopes: ["plain", "resource_key", "data", "result"],
        namingIntensities: ["moderate", "high", "maximum"],
        uiLayouts: [...AI_UI_LAYOUTS],
        uiDensities: [...AI_UI_DENSITIES],
        navigationPatterns: [...AI_UI_NAVIGATION_PATTERNS],
        dashboardBlocks: [...AI_DASHBOARD_BLOCKS],
        paymentStatuses: [...PAYMENT_STATUSES]
      },
      reservedRouteSlugs: [...RESERVED_PUBLIC_ROUTES],
      validationRules: {
        routeSlugPattern: "^[a-z0-9][a-z0-9_-]{1,80}$",
        aliasPattern: "^[A-Za-z][A-Za-z0-9_-]{1,60}$",
        requiredEntities: ["register", "login", "account", "metrics", "payments", "customers", "paymentMethods", "balances"],
        uniquenessThreshold: BRAND_SPEC_UNIQUENESS_THRESHOLD,
        notes: [
          "Routes are slug-only path segments without leading slash.",
          "All ten payment statuses must be mapped.",
          "register/login require POST and no session; account/metrics/balances require GET and session.",
          "Specs below uniqueness threshold are stored as invalid drafts until revised."
        ]
      },
      safetyRules: [
        "Generated UI must not expose brandId.",
        "Generated UI must not call or display /bff, /runtime, /profile, or /rest-api.",
        "Generated UI must use only /:brandSlug/app/:view and /:brandSlug/:entitySlug in visible browser requests.",
        "Do not use canonical public entity names when the spec provides brand-specific route slugs.",
        "Do not include secrets, API keys, database names, or internal DTO names in generated files."
      ],
      examplePrompts: {
        codex: "Generate a complete LayoutBuilderAiBrandSpec for a merchant payment gateway. Use unique entity slugs, field aliases, status names, labels, and UI presentation. Return only JSON.",
        gemini: "Create a brand-specific payment gateway spec with a unique dashboard layout, disguised route slugs, custom auth fields, and all ten payment status mappings."
      },
      examples: {
        createDraft: {
          brandName: "Aster Vault",
          adminPrompt: "Create a premium merchant payment gateway for wallet settlements with unique routes and compact ledger UI.",
          provider: "gemini",
          model: "gemini-2.5-flash-lite",
          controls: spec.controls
        },
        importSpec: {
          brandName: "Aster Vault",
          adminPrompt: "External agent generated a wallet settlement gateway.",
          provider: "codex",
          model: "codex-agent",
          controls: spec.controls,
          spec
        },
        aiBrandSpec: spec
      }
    };
  }
}

function exampleSpec(): LayoutBuilderAiBrandSpec {
  return {
    brand: {
      displayName: "Aster Vault",
      visualDirection: "Compact wallet settlement console with dark graphite surfaces, mint signal accents, and operator-first ledger density.",
      contractSummary: "Aster Vault exposes wallet settlement flows through brand-specific public routes and payload names.",
      paletteHints: ["graphite", "mint", "white", "signal blue"]
    },
    controls: {
      payloadStructure: "nested",
      fieldStyle: "snake_case",
      authShape: "workspace",
      responseEnvelope: "resource_key",
      routeNaming: "finance",
      errorStyle: "branded",
      namingIntensity: "maximum"
    },
    resourceAlias: "vault_movements",
    entities: {
      register: entity("open-vault", "POST", false, "vault_access", "vault_session"),
      login: entity("resume-vault", "POST", false, "access_phrase", "session_grant"),
      account: entity("operator-seat", "GET", true, "seat_lookup", "seat_record"),
      metrics: entity("signal-board", "GET", true, "signal_scope", "signal_pack"),
      payments: entity("movement-ledger", "GET", true, "ledger_filter", "movement_rows"),
      customers: entity("counterparty-book", "GET", true, "party_filter", "counterparty_rows"),
      paymentMethods: entity("rail-vault", "GET", true, "rail_filter", "rail_rows"),
      balances: entity("reserve-stream", "GET", true, "reserve_scope", "reserve_rows")
    },
    fields: {
      payment: {
        paymentId: "movement_ref",
        externalReference: "merchant_marker",
        paymentIntentId: "intent_marker",
        customerId: "counterparty_ref",
        paymentMethodId: "rail_ref",
        status: "movement_state",
        amount: "settlement_value",
        currency: "settlement_unit",
        destinationLabel: "receiver_label",
        methodType: "rail_kind",
        createdAt: "initiated_at"
      },
      customer: { customerId: "counterparty_ref", email: "counterparty_mail", name: "counterparty_name", phone: "counterparty_line" },
      paymentMethod: {
        paymentMethodId: "rail_ref",
        type: "rail_kind",
        label: "rail_label",
        last4: "rail_tail",
        brand: "rail_network",
        expiryMonth: "valid_month",
        expiryYear: "valid_year",
        bankName: "institution_name"
      },
      balance: {
        balanceTransactionId: "reserve_ref",
        paymentId: "movement_ref",
        type: "reserve_kind",
        amount: "reserve_value",
        currency: "reserve_unit",
        description: "reserve_note",
        createdAt: "posted_at"
      },
      account: { accountId: "seat_ref", balance: "available_reserve", currency: "reserve_unit" },
      user: { userId: "operator_ref", email: "operator_mail", displayName: "operator_name" },
      metrics: { count: "movement_count", volume: "vault_volume", customers: "counterparty_count", review: "review_queue", currency: "reserve_unit" }
    },
    auth: {
      tokenResponseKey: "vault_pass",
      tokenStorageKey: "aster:vault:session",
      errorKey: "vault_access_issue",
      fields: { email: "operator_mail", password: "access_phrase", displayName: "operator_name", currency: "reserve_unit" }
    },
    statuses: {
      created: "movementOpened",
      requires_payment_method: "railRequired",
      requires_confirmation: "approvalRequired",
      processing: "railRouting",
      authorized: "reserveHeld",
      captured: "valueCaptured",
      settled: "vaultPosted",
      failed: "movementBlocked",
      canceled: "movementVoided",
      refunded: "valueReturned"
    },
    ui: {
      labels: {
        register: "Open vault",
        login: "Resume vault",
        createPayment: "Route movement",
        history: "Movement ledger",
        refund: "Return value",
        overview: "Signal board",
        payments: "Movements",
        customers: "Counterparties",
        balances: "Reserve stream"
      },
      navigation: { dashboard: "Signals", payments: "Ledger", customers: "Parties", balances: "Reserve" },
      tableLabels: { id: "Movement", status: "State", amount: "Value", customer: "Counterparty", createdAt: "Initiated" },
      formLabels: { amount: "Settlement value", customer: "Counterparty", method: "Rail" },
      presentation: {
        layout: "command-center",
        density: "compact",
        navigationPattern: "command-rail",
        dashboardComposition: ["metrics", "recentPayments", "balances", "customers", "createPayment"],
        visualTokens: {
          palette: ["graphite", "mint", "white", "signal blue"],
          typography: "compact sans with tabular figures",
          radius: "6px",
          spacing: "tight operational spacing",
          surfaces: "graphite shell with white ledger panels",
          buttons: "mint primary actions and quiet graphite secondary controls"
        },
        copyTone: "precise wallet settlement operations language",
        componentLabels: { metricsCard: "Signal board", paymentTable: "Movement ledger", createPanel: "Route movement" },
        emptyStates: { payments: "No vault movements yet.", customers: "No counterparties linked.", balances: "No reserve postings yet." }
      }
    }
  };
}

function entity(route: string, method: "GET" | "POST", requiresSession: boolean, requestKey: string, responseKey: string) {
  return { route, method, requiresSession, requestKey, responseKey, emptyState: "No records are available yet." };
}

function createBrandDraftJsonSchema(): Record<string, unknown> {
  return objectSchema({
    brandName: stringSchema(),
    adminPrompt: stringSchema(),
    systemPrompt: stringSchema(),
    provider: enumSchema(["local", "gemini"]),
    model: stringSchema(),
    controls: controlsSchema()
  });
}

function createBrandDraftFromSpecJsonSchema(): Record<string, unknown> {
  return objectSchema({
    brandName: stringSchema(),
    adminPrompt: stringSchema(),
    systemPrompt: stringSchema(),
    provider: enumSchema(["local", "openai", "gemini", "anthropic", "codex"]),
    model: stringSchema(),
    controls: controlsSchema(),
    spec: aiBrandSpecJsonSchema()
  });
}

function aiBrandSpecJsonSchema(): Record<string, unknown> {
  return objectSchema({
    brand: objectSchema({
      displayName: stringSchema(),
      visualDirection: stringSchema(),
      contractSummary: stringSchema(),
      paletteHints: arraySchema(stringSchema())
    }),
    controls: controlsSchema(),
    resourceAlias: stringSchema(),
    entities: objectSchema({
      register: entitySchema("POST"),
      login: entitySchema("POST"),
      account: entitySchema("GET"),
      metrics: entitySchema("GET"),
      payments: entitySchema("GET"),
      customers: entitySchema("GET"),
      paymentMethods: entitySchema("GET"),
      balances: entitySchema("GET")
    }),
    fields: objectSchema({
      payment: recordStringSchema(),
      customer: recordStringSchema(),
      paymentMethod: recordStringSchema(),
      balance: recordStringSchema(),
      account: recordStringSchema(),
      user: recordStringSchema(),
      metrics: recordStringSchema()
    }),
    auth: objectSchema({
      tokenResponseKey: stringSchema(),
      tokenStorageKey: stringSchema(),
      errorKey: stringSchema(),
      fields: objectSchema({ email: stringSchema(), password: stringSchema(), displayName: stringSchema(), currency: stringSchema() })
    }),
    statuses: objectSchema(Object.fromEntries(PAYMENT_STATUSES.map((status) => [status, stringSchema()]))),
    ui: objectSchema({
      labels: recordStringSchema(),
      navigation: recordStringSchema(),
      tableLabels: recordStringSchema(),
      formLabels: recordStringSchema(),
      presentation: objectSchema({
        layout: enumSchema(AI_UI_LAYOUTS),
        density: enumSchema(AI_UI_DENSITIES),
        navigationPattern: enumSchema(AI_UI_NAVIGATION_PATTERNS),
        dashboardComposition: arraySchema(enumSchema(AI_DASHBOARD_BLOCKS)),
        visualTokens: objectSchema({
          palette: arraySchema(stringSchema()),
          typography: stringSchema(),
          radius: stringSchema(),
          spacing: stringSchema(),
          surfaces: stringSchema(),
          buttons: stringSchema()
        }),
        copyTone: stringSchema(),
        componentLabels: recordStringSchema(),
        emptyStates: recordStringSchema()
      })
    })
  });
}

function controlsSchema(): Record<string, unknown> {
  return objectSchema({
    payloadStructure: enumSchema(["flat", "nested", "key-value-array"]),
    fieldStyle: enumSchema(["camelCase", "snake_case", "kebab-case"]),
    authShape: enumSchema(["credentials", "access_key", "workspace"]),
    responseEnvelope: enumSchema(["plain", "resource_key", "data", "result"]),
    routeNaming: enumSchema(["product", "finance", "abstract"]),
    errorStyle: enumSchema(["standard", "branded"]),
    namingIntensity: enumSchema(["moderate", "high", "maximum"])
  });
}

function entitySchema(method: "GET" | "POST"): Record<string, unknown> {
  return objectSchema({
    route: stringSchema(),
    method: enumSchema([method]),
    requiresSession: { type: "boolean" },
    requestKey: stringSchema(),
    responseKey: stringSchema(),
    emptyState: stringSchema()
  });
}

function objectSchema(properties: Record<string, unknown>): Record<string, unknown> {
  return { type: "object", required: Object.keys(properties), properties };
}

function recordStringSchema(): Record<string, unknown> {
  return { type: "object", additionalProperties: { type: "string" } };
}

function stringSchema(): Record<string, unknown> {
  return { type: "string" };
}

function arraySchema(items: Record<string, unknown>): Record<string, unknown> {
  return { type: "array", items };
}

function enumSchema(values: readonly string[]): Record<string, unknown> {
  return { type: "string", enum: values };
}
