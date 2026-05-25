import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAgentManifest,
  LayoutBuilderAiBrandSpec,
  LayoutBuilderBrandGenerationIntent,
  LayoutBuilderBrandIntentManifest
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
  getIntentManifest(): LayoutBuilderBrandIntentManifest {
    const intent = exampleIntent();

    return {
      manifestVersion: "2026-05-24.brand-intent-agent.v1",
      purpose: "Minimal contract for external chats that create unique payment gateway brand intents. The chat should not generate internal API specs.",
      recommendedFlow: "external_chat_intent",
      endpoints: [
        {
          method: "GET",
          path: "/ai-agent/brand-intent-manifest",
          authRequired: false,
          contentType: "application/json",
          purpose: "Read the minimal intent schema, examples, and naming restrictions."
        },
        {
          method: "POST",
          path: "/brands/intent-drafts",
          authRequired: true,
          contentType: "application/json",
          purpose: "Submit a chat-authored brand intent. Backend validates and compiles it into a runtime contract draft."
        },
        {
          method: "GET",
          path: "/brands/intent-drafts/:draftId",
          authRequired: true,
          contentType: "application/json",
          purpose: "Read compiled draft status, validation issues, and generated integration preview."
        },
        {
          method: "POST",
          path: "/brands/intent-drafts/:draftId/create",
          authRequired: true,
          contentType: "multipart/form-data",
          purpose: "Create a working brand from a valid compiled intent draft. Requires logo file."
        }
      ],
      codexPrompt: {
        system: [
          "You are a Codex brand-generation agent working from a repository-local manifest.",
          "Before creating a brand, fetch this manifest from Layout Builder and ask the user for the missing inputs listed in userQuestions.",
          "Generate only BrandGenerationIntent JSON and submit it to Layout Builder; do not invent internal contracts or expose private BFF configuration.",
          "The current runtime target is a single seeded payments page, so optimize the visual system for payment review, status scanning, and transaction comprehension."
        ].join(" "),
        userQuestions: [
          {
            id: "audience",
            label: "Audience",
            prompt: "Who is this payment brand for, and how young, playful, premium, or operational should it feel?",
            required: true,
            reason: "Audience drives density, copy tone, typography, and control language."
          },
          {
            id: "visual_direction",
            label: "Visual Direction",
            prompt: "Which colors, logo style, references, and visual patterns should the interface use or avoid?",
            required: true,
            reason: "The compiler needs concrete visual constraints to avoid repeating prior brands."
          },
          {
            id: "payment_metaphor",
            label: "Metaphor",
            prompt: "What metaphor should describe payment activity: stream, drops, cargo, pulses, trades, orders, tickets, or something else?",
            required: true,
            reason: "Metaphor becomes route vocabulary, labels, statuses, and copy."
          },
          {
            id: "layout_direction",
            label: "Layout",
            prompt: "Should the payments page feel like a terminal, split workspace, card wall, command board, or dense ledger?",
            required: false,
            reason: "Layout choice must materially change the generated interface."
          },
          {
            id: "auth_experience",
            label: "Auth Style",
            prompt: "How should login and registration feel: minimal, game-like, premium, terminal-like, social, or another specific access ritual?",
            required: false,
            reason: "Auth style is generated into authExperience instead of selected from a fixed login template."
          },
          {
            id: "payments_experience",
            label: "Payments UI",
            prompt: "How should seeded payment activity be organized: ledger, cards, timeline, market tickets, compact trade feed, or another specific pattern?",
            required: false,
            reason: "Payments UI is generated into paymentsExperience instead of selected from a fixed payments template."
          },
          {
            id: "restricted_words",
            label: "Forbidden Words",
            prompt: "Which public words should never appear in routes, labels, or field aliases?",
            required: false,
            reason: "Forbidden words are stored in the private dictionary and protect brand-specific contracts."
          }
        ],
        outputContract: [
          "Ask concise clarification questions before generating when required inputs are missing.",
          "Return or submit one JSON object matching LayoutBuilderBrandGenerationIntent.",
          "Target one brand-facing page: /:brandSlug/app/payments with seeded payment activity.",
          "Use unique route language and field aliases; avoid canonical words in visible routes.",
          "Vary layout architecture, payment row or tile pattern, metrics, status treatment, typography, and color tokens compared with recent brands.",
          "Generate authExperience with numeric composition, field copy, surface treatment, and mobile order; do not choose from fixed login templates.",
          "Generate paymentsExperience with numeric composition, metrics placement, activity pattern, status treatment, and visible payment fields; do not choose from fixed payments templates.",
          "Let Layout Builder compile and store generationProfile.dictionary for BFF-only decoding and encoding."
        ]
      },
      requiredCapabilities: ["auth", "account", "balances", "payments", "customers", "paymentMethods", "paymentCreation"],
      schema: brandIntentJsonSchema(),
      hiddenBffConfig: {
        generatedBy: "layout-builder",
        storedAs: "generationProfile.dictionary",
        clientVisibility: "brand runtime receives only public aliases, labels, UI tokens, and brand routes",
        includes: [
          "visibility",
          "source",
          "controls",
          "forbiddenPublicTerms",
          "publicRoutes",
          "requestKeys",
          "responseKeys",
          "fieldAliases",
          "statusAliases",
          "actionLabels",
          "visualTokens",
          "authExperience",
          "paymentsExperience"
        ]
      },
      rules: {
        doNotMention: [
          "brandId",
          "payment-core",
          "BFF",
          "runtime",
          "DTO",
          "database",
          "canonical entity names",
          "internal service names"
        ],
        routeGuidance: [
          "Describe route naming style and forbidden words; do not emit final endpoint paths.",
          "Prefer product-language nouns, metaphors, and verbs.",
          "Avoid generic names such as payments, customers, balances, account, profile, runtime, bff, and rest-api."
        ],
        uniquenessGuidance: [
          "Pick a distinct payment metaphor, auth metaphor, visual model, and vocabulary family.",
          "Do not reuse settlement ledger console language unless explicitly requested.",
          "Include preferredTerms that can drive route and field naming without hashes.",
          "Vary payload structure, field style, response envelope, dashboard composition, and navigation pattern where the brief allows.",
          "For the brand-facing app, treat payments as the only required page and make the payment activity pattern visibly different from recent brands.",
          "Do not rely on palette and copy changes alone; change layout architecture, density, status treatment, metric grouping, row or tile geometry, and typography.",
          "For auth, generate authExperience with numeric layout, field copy, form control style, surface treatment, and visual notes instead of relying on canned login templates.",
          "For the payments page, generate paymentsExperience with metrics placement, activity pattern, status treatment, field visibility, and numeric layout instead of relying on canned payments templates."
        ],
        requiredVariation: [
          "domain",
          "audience",
          "productMetaphor",
          "authMetaphor",
          "paymentMetaphor",
          "visualStyle",
          "palette",
          "copy tone",
          "authExperience",
          "paymentsExperience"
        ]
      },
      examples: {
        promptForChat: [
          "Return only JSON matching the BrandGenerationIntent schema.",
          "Create a unique payment gateway brand concept for merchants.",
          "Do not generate API endpoints or internal contracts.",
          "Ask the user for missing audience, visual, metaphor, layout, and forbidden-word inputs before generating.",
          "Focus on a single seeded payments page, naming restrictions, product metaphor, UI direction, copy, and status vocabulary."
        ].join(" "),
        intent
      }
    };
  }

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
        authExperience: {
          content: {
            headline: "Aster Vault",
            description: "Secure access for operators returning to a compact wallet settlement console."
          },
          layout: {
            brandColumn: 46,
            formMaxWidth: 400,
            logoSize: 72,
            panelPadding: 18,
            gap: 28,
            brandAlignment: "center",
            formAlignment: "center",
            textAlign: "center",
            mobileOrder: "brand-first"
          },
          form: {
            modeControl: "toggle",
            fieldTreatment: "filled",
            surface: "outlined",
            showDisplayNameOnLogin: false,
            fields: {
              email: { label: "Operator email", placeholder: "client@example.com" },
              password: { label: "Access phrase", placeholder: "local-demo-password" },
              displayName: { label: "Operator name", placeholder: "Aster Vault operator" }
            }
          },
          visual: {
            background: "graphite settlement shell with mint edge light",
            panel: "outlined operator module with high-contrast fields",
            accent: "mint signal line on active auth mode"
          }
        },
        paymentsExperience: {
          content: {
            headline: "Movement ledger",
            description: "Balance-first settlement movements with compact review signals and counterparty context.",
            emptyState: "No vault movements yet."
          },
          composition: {
            metricsPlacement: "left",
            activityPattern: "timeline",
            statusTreatment: "dot",
            amountEmphasis: "balanced",
            showCustomer: true,
            showMethod: true,
            showTimestamp: true,
            maxItems: 12
          },
          layout: {
            metricsColumns: 1,
            sidebarWidth: 260,
            cardMinWidth: 240,
            gap: 14,
            panelPadding: 14,
            rowMinHeight: 58
          },
          visual: {
            surface: "graphite shell with white ledger panels",
            status: "mint signal states on movement rows",
            dataDensity: "compact settlement review density"
          }
        },
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

function exampleIntent(): LayoutBuilderBrandGenerationIntent {
  return {
    brandName: "Copper Harbor",
    concept: {
      domain: "merchant acquiring for regional commerce teams",
      audience: "market operators",
      productMetaphor: "harbor control",
      authMetaphor: "dock pass",
      paymentMetaphor: "cargo clearing",
      tone: "practical port-operations finance language",
      avoidWords: ["stripe", "payment-core", "bff", "runtime", "profile"],
      preferredTerms: ["harbor", "dock", "cargo", "operator", "berth", "tide"]
    },
    namingRules: {
      routeStyle: "short operational harbor terms without generic payment words",
      fieldStyle: "snake_case" as const,
      forbiddenCanonicalNames: ["payments", "customers", "balances", "account", "metrics", "profile"],
      examples: ["cargo-ledger", "dock-pass", "tide-stream", "operator-book"]
    },
    uiDirection: {
      layout: "split-workspace",
      density: "balanced",
      navigation: "command-rail",
      visualStyle: "split harbor operations workspace with muted copper surfaces, steel borders, and tide-blue action states",
      palette: ["copper", "steel", "tide blue", "white"],
      dashboardBlocks: ["metrics", "recentPayments", "balances", "createPayment"]
    },
    copy: {
      loginTitle: "Enter dock",
      registerTitle: "Issue dock pass",
      emptyStates: {
        payments: "No cargo clearings have been logged.",
        customers: "No operators are in the harbor book.",
        balances: "No tide stream movements are posted."
      },
      actionLabels: {
        createPayment: "Clear cargo",
        history: "Cargo ledger",
        refund: "Reverse cargo",
        overview: "Harbor board",
        payments: "Cargo clearings",
        customers: "Operator book",
        balances: "Tide stream"
      }
    },
    authExperience: {
      content: {
        headline: "Copper Harbor",
        description: "Dock-pass access for market operators clearing cargo-style payment activity."
      },
      layout: {
        brandColumn: 44,
        formMaxWidth: 430,
        logoSize: 86,
        panelPadding: 22,
        gap: 32,
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
          email: { label: "Operator email", placeholder: "client@example.com" },
          password: { label: "Dock pass", placeholder: "local-demo-password" },
          displayName: { label: "Operator name", placeholder: "Copper Harbor operator" }
        }
      },
      visual: {
        background: "split harbor operations workspace with copper and steel balance",
        panel: "raised access panel with clean payment-ops hierarchy",
        accent: "tide-blue active state for login and registration controls"
      }
    },
    paymentsExperience: {
      content: {
        headline: "Cargo clearings",
        description: "A split harbor board where market operators scan cargo-style payment movements and reserve states.",
        emptyState: "No cargo clearings have been logged."
      },
      composition: {
        metricsPlacement: "left",
        activityPattern: "cards",
        statusTreatment: "rail",
        amountEmphasis: "primary",
        showCustomer: true,
        showMethod: true,
        showTimestamp: true,
        maxItems: 10
      },
      layout: {
        metricsColumns: 1,
        sidebarWidth: 260,
        cardMinWidth: 260,
        gap: 18,
        panelPadding: 16,
        rowMinHeight: 72
      },
      visual: {
        surface: "copper and steel payment board with tide-blue separators",
        status: "status rail on each cargo card",
        dataDensity: "balanced scan density for repeated payment review"
      }
    },
    statusVocabulary: {
      created: "cargoLogged",
      requires_payment_method: "berthMissing",
      requires_confirmation: "dockReview",
      processing: "tideMoving",
      authorized: "harborHold",
      captured: "cargoSecured",
      settled: "cargoCleared",
      failed: "dockRejected",
      canceled: "cargoVoided",
      refunded: "cargoReturned"
    }
  };
}

function brandIntentJsonSchema(): unknown {
  return objectSchema({
    brandName: stringSchema(),
    concept: objectSchema({
      domain: stringSchema(),
      audience: stringSchema(),
      productMetaphor: stringSchema(),
      authMetaphor: stringSchema(),
      paymentMetaphor: stringSchema(),
      tone: stringSchema(),
      avoidWords: arraySchema(stringSchema()),
      preferredTerms: arraySchema(stringSchema())
    }),
    namingRules: objectSchema({
      routeStyle: stringSchema(),
      fieldStyle: enumSchema(["camelCase", "snake_case", "kebab-case"]),
      forbiddenCanonicalNames: arraySchema(stringSchema()),
      examples: arraySchema(stringSchema())
    }),
    uiDirection: objectSchema({
      layout: stringSchema(),
      density: stringSchema(),
      navigation: stringSchema(),
      visualStyle: stringSchema(),
      palette: arraySchema(stringSchema()),
      dashboardBlocks: arraySchema(stringSchema())
    }),
    copy: objectSchema({
      loginTitle: stringSchema(),
      registerTitle: stringSchema(),
      emptyStates: recordStringSchema(),
      actionLabels: recordStringSchema()
    }),
    authExperience: authExperienceJsonSchema(),
    paymentsExperience: paymentsExperienceJsonSchema(),
    statusVocabulary: recordStringSchema()
  });
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
      authExperience: authExperienceJsonSchema(),
      paymentsExperience: paymentsExperienceJsonSchema(),
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

function authExperienceJsonSchema(): Record<string, unknown> {
  return objectSchema({
    content: objectSchema({
      headline: stringSchema(),
      description: stringSchema()
    }),
    layout: objectSchema({
      brandColumn: { type: "integer", minimum: 30, maximum: 70 },
      formMaxWidth: { type: "integer", minimum: 320, maximum: 620 },
      logoSize: { type: "integer", minimum: 48, maximum: 128 },
      panelPadding: { type: "integer", minimum: 12, maximum: 40 },
      gap: { type: "integer", minimum: 16, maximum: 72 },
      brandAlignment: enumSchema(["start", "center", "end"]),
      formAlignment: enumSchema(["start", "center", "end"]),
      textAlign: enumSchema(["left", "center", "right"]),
      mobileOrder: enumSchema(["brand-first", "form-first"])
    }),
    form: objectSchema({
      modeControl: enumSchema(["segmented", "tabs", "toggle"]),
      fieldTreatment: enumSchema(["boxed", "filled", "underlined"]),
      surface: enumSchema(["flat", "raised", "outlined"]),
      showDisplayNameOnLogin: { type: "boolean" },
      fields: objectSchema({
        email: objectSchema({ label: stringSchema(), placeholder: stringSchema() }),
        password: objectSchema({ label: stringSchema(), placeholder: stringSchema() }),
        displayName: objectSchema({ label: stringSchema(), placeholder: stringSchema() })
      })
    }),
    visual: objectSchema({
      background: stringSchema(),
      panel: stringSchema(),
      accent: stringSchema()
    })
  });
}

function paymentsExperienceJsonSchema(): Record<string, unknown> {
  return objectSchema({
    content: objectSchema({
      headline: stringSchema(),
      description: stringSchema(),
      emptyState: stringSchema()
    }),
    composition: objectSchema({
      metricsPlacement: enumSchema(["top", "left", "right", "hidden"]),
      activityPattern: enumSchema(["table", "cards", "timeline"]),
      statusTreatment: enumSchema(["badge", "rail", "dot"]),
      amountEmphasis: enumSchema(["primary", "secondary", "balanced"]),
      showCustomer: { type: "boolean" },
      showMethod: { type: "boolean" },
      showTimestamp: { type: "boolean" },
      maxItems: { type: "integer", minimum: 4, maximum: 30 }
    }),
    layout: objectSchema({
      metricsColumns: { type: "integer", minimum: 1, maximum: 5 },
      sidebarWidth: { type: "integer", minimum: 180, maximum: 420 },
      cardMinWidth: { type: "integer", minimum: 180, maximum: 420 },
      gap: { type: "integer", minimum: 8, maximum: 48 },
      panelPadding: { type: "integer", minimum: 10, maximum: 36 },
      rowMinHeight: { type: "integer", minimum: 44, maximum: 112 }
    }),
    visual: objectSchema({
      surface: stringSchema(),
      status: stringSchema(),
      dataDensity: stringSchema()
    })
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
