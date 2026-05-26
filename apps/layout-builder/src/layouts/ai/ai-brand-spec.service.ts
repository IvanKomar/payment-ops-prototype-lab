import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiBrandSpec,
  LayoutBuilderAiGenerationControls,
  LayoutBuilderAiProvider,
  LayoutBuilderBrandGenerationMessage,
  LayoutBuilderCreateBrandDraftRequest,
  PaymentCoreStatus
} from "@payment-ops/shared-types";
import { createHash } from "node:crypto";
import { z } from "zod";

import type { LayoutBuilderEnv } from "../../config/env.schema.js";
import { LAYOUT_BUILDER_CONFIG } from "../layout.constants.js";
import { DEFAULT_BRAND_AI_SYSTEM_PROMPT } from "./ai-brand-generator.service.js";

export const DEFAULT_AI_GENERATION_CONTROLS: LayoutBuilderAiGenerationControls = {
  payloadStructure: "nested",
  fieldStyle: "snake_case",
  authShape: "workspace",
  responseEnvelope: "resource_key",
  routeNaming: "finance",
  errorStyle: "branded",
  namingIntensity: "maximum"
};

const paymentStatuses = [
  "created",
  "requires_payment_method",
  "requires_confirmation",
  "processing",
  "authorized",
  "captured",
  "settled",
  "failed",
  "canceled",
  "refunded"
] as const satisfies readonly PaymentCoreStatus[];
export const PAYMENT_STATUSES = paymentStatuses;

export const AI_UI_LAYOUTS = [
  "sidebar-ledger",
  "topbar-console",
  "split-workspace",
  "command-center",
  "card-operations",
  "compact-terminal"
] as const;
export const AI_UI_DENSITIES = ["compact", "balanced", "spacious"] as const;
export const AI_UI_NAVIGATION_PATTERNS = ["sidebar", "top-tabs", "command-rail"] as const;
export const AI_DASHBOARD_BLOCKS = ["metrics", "recentPayments", "balances", "customers", "createPayment"] as const;
const AI_AUTH_ALIGNMENTS = ["start", "center", "end"] as const;
const AI_AUTH_TEXT_ALIGNMENTS = ["left", "center", "right"] as const;
const AI_AUTH_MOBILE_ORDERS = ["brand-first", "form-first"] as const;
const AI_AUTH_MODE_CONTROLS = ["segmented", "tabs", "toggle"] as const;
const AI_AUTH_FIELD_TREATMENTS = ["boxed", "filled", "underlined"] as const;
const AI_AUTH_SURFACES = ["flat", "raised", "outlined"] as const;
const AI_PAYMENTS_METRICS_PLACEMENTS = ["top", "left", "right", "hidden"] as const;
const AI_PAYMENTS_ACTIVITY_PATTERNS = ["table"] as const;
const AI_PAYMENTS_STATUS_TREATMENTS = ["badge", "rail", "dot"] as const;
const AI_PAYMENTS_AMOUNT_EMPHASIS = ["primary", "secondary", "balanced"] as const;
const AI_PAYMENTS_COMPOSER_PLACEMENTS = ["intro", "activity-top", "activity-bottom", "sidecar"] as const;
const AI_PAYMENTS_COMPOSER_SURFACES = ["compact", "panel", "inline"] as const;
const AI_PAYMENTS_COMPOSER_TONES = ["minimal", "operator", "guided"] as const;
const AI_PAYMENT_SCENARIOS = ["settle", "review", "reserve", "fail"] as const;
const AI_PAYMENTS_TABLE_COLUMN_KEYS = ["reference", "status", "amount", "customer", "method", "createdAt", "destination"] as const;
const AI_PAYMENTS_TABLE_TITLE_PLACEMENTS = ["page", "table", "hidden"] as const;
const AI_PAYMENTS_TABLE_CONTROL_PLACEMENTS = ["above", "side", "none"] as const;
const AI_PAYMENTS_TABLE_DENSITIES = ["compact", "regular", "spacious"] as const;

const slugSchema = z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,80}$/u);
const aliasSchema = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{1,60}$/u);
const storageKeySchema = z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_:-]{1,100}$/u);
export const RESERVED_PUBLIC_ROUTES = [
  "app",
  "profile",
  "bff",
  "runtime",
  "rest-api",
  "_runtime",
  "account",
  "accounts",
  "payments",
  "customers",
  "payment-methods",
  "payment_methods",
  "balances",
  "metrics"
] as const;
const reservedPublicRoutes = new Set<string>(RESERVED_PUBLIC_ROUTES);
const entitySpecSchema = z.object({
  route: slugSchema,
  method: z.enum(["GET", "POST"]),
  requiresSession: z.boolean(),
  requestKey: aliasSchema,
  responseKey: aliasSchema,
  emptyState: z.string().trim().min(1).max(240)
});
const controlsSchema = z.object({
  payloadStructure: z.enum(["flat", "nested", "key-value-array"]),
  fieldStyle: z.enum(["camelCase", "snake_case", "kebab-case"]),
  authShape: z.enum(["credentials", "access_key", "workspace"]),
  responseEnvelope: z.enum(["plain", "resource_key", "data", "result"]),
  routeNaming: z.enum(["product", "finance", "abstract"]),
  errorStyle: z.enum(["standard", "branded"]),
  namingIntensity: z.enum(["moderate", "high", "maximum"])
});
const fieldGroupSchema = z.record(z.string().min(1), aliasSchema);
const uiPresentationSchema = z.object({
  layout: z.enum(AI_UI_LAYOUTS),
  density: z.enum(AI_UI_DENSITIES),
  navigationPattern: z.enum(AI_UI_NAVIGATION_PATTERNS),
  dashboardComposition: z.array(z.enum(AI_DASHBOARD_BLOCKS)).min(3).max(AI_DASHBOARD_BLOCKS.length),
  visualTokens: z.object({
    palette: z.array(z.string().trim().min(1).max(80)).min(3).max(8),
    typography: z.string().trim().min(1).max(120),
    radius: z.string().trim().min(1).max(80),
    spacing: z.string().trim().min(1).max(80),
    surfaces: z.string().trim().min(1).max(180),
    buttons: z.string().trim().min(1).max(180)
  }),
  copyTone: z.string().trim().min(1).max(240),
  componentLabels: z.record(z.string().min(1), z.string().trim().min(1).max(100)),
  emptyStates: z.record(z.string().min(1), z.string().trim().min(1).max(180))
});
const authExperienceFieldSchema = z.object({
  label: z.string().trim().min(1).max(80),
  placeholder: z.string().trim().min(1).max(120)
});
const authExperienceSchema = z.object({
  content: z.object({
    headline: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(260)
  }),
  composition: z.object({
    frame: z.enum(["split", "centered", "offset", "console", "minimal"]),
    brandTreatment: z.enum(["stacked", "inline", "badge"]),
    showDescription: z.boolean()
  }),
  layout: z.object({
    brandColumn: z.number().int().min(30).max(70),
    formMaxWidth: z.number().int().min(320).max(620),
    logoSize: z.number().int().min(48).max(128),
    panelPadding: z.number().int().min(12).max(40),
    gap: z.number().int().min(16).max(72),
    brandAlignment: z.enum(AI_AUTH_ALIGNMENTS),
    formAlignment: z.enum(AI_AUTH_ALIGNMENTS),
    textAlign: z.enum(AI_AUTH_TEXT_ALIGNMENTS),
    mobileOrder: z.enum(AI_AUTH_MOBILE_ORDERS)
  }),
  form: z.object({
    modeControl: z.enum(AI_AUTH_MODE_CONTROLS),
    fieldTreatment: z.enum(AI_AUTH_FIELD_TREATMENTS),
    surface: z.enum(AI_AUTH_SURFACES),
    showDisplayNameOnLogin: z.boolean(),
    fields: z.object({
      email: authExperienceFieldSchema,
      password: authExperienceFieldSchema,
      displayName: authExperienceFieldSchema
    })
  }),
  visual: z.object({
    background: z.string().trim().min(1).max(180),
    panel: z.string().trim().min(1).max(180),
    accent: z.string().trim().min(1).max(160)
  })
});
const paymentsExperienceSchema = z.object({
  content: z.object({
    headline: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(260),
    emptyState: z.string().trim().min(1).max(180)
  }),
  composition: z.object({
    metricsPlacement: z.enum(AI_PAYMENTS_METRICS_PLACEMENTS),
    activityPattern: z.enum(AI_PAYMENTS_ACTIVITY_PATTERNS),
    statusTreatment: z.enum(AI_PAYMENTS_STATUS_TREATMENTS),
    amountEmphasis: z.enum(AI_PAYMENTS_AMOUNT_EMPHASIS),
    showCustomer: z.boolean(),
    showMethod: z.boolean(),
    showTimestamp: z.boolean(),
    maxItems: z.number().int().min(4).max(30)
  }),
  layout: z.object({
    metricsColumns: z.number().int().min(1).max(5),
    sidebarWidth: z.number().int().min(180).max(420),
    cardMinWidth: z.number().int().min(180).max(420),
    gap: z.number().int().min(8).max(48),
    panelPadding: z.number().int().min(10).max(36),
    rowMinHeight: z.number().int().min(44).max(112)
  }),
  table: z.object({
    titlePlacement: z.enum(AI_PAYMENTS_TABLE_TITLE_PLACEMENTS),
    controlsPlacement: z.enum(AI_PAYMENTS_TABLE_CONTROL_PLACEMENTS),
    density: z.enum(AI_PAYMENTS_TABLE_DENSITIES),
    columns: z
      .array(
        z.object({
          key: z.enum(AI_PAYMENTS_TABLE_COLUMN_KEYS),
          label: z.string().trim().min(1).max(50),
          priority: z.number().int().min(1).max(7)
        })
      )
      .min(4)
      .max(7)
      .superRefine((columns, context) => {
        const keys = columns.map((column) => column.key);
        const duplicates = keys.filter((key, index) => keys.indexOf(key) !== index);

        if (duplicates.length > 0) {
          context.addIssue({ code: "custom", message: `Duplicate payment table columns: ${duplicates.join(", ")}` });
        }

        if (!keys.includes("reference") || !keys.includes("status") || !keys.includes("amount")) {
          context.addIssue({ code: "custom", message: "Payment table must include reference, status, and amount columns" });
        }
      })
  }),
  visual: z.object({
    surface: z.string().trim().min(1).max(180),
    status: z.string().trim().min(1).max(160),
    dataDensity: z.string().trim().min(1).max(160)
  }),
  createPayment: z.object({
    enabled: z.boolean(),
    placement: z.enum(AI_PAYMENTS_COMPOSER_PLACEMENTS),
    surface: z.enum(AI_PAYMENTS_COMPOSER_SURFACES),
    tone: z.enum(AI_PAYMENTS_COMPOSER_TONES),
    defaultScenario: z.enum(AI_PAYMENT_SCENARIOS),
    labels: z.object({
      title: z.string().trim().min(1).max(80),
      amount: z.string().trim().min(1).max(50),
      currency: z.string().trim().min(1).max(50),
      customer: z.string().trim().min(1).max(60),
      customerEmail: z.string().trim().min(1).max(60),
      methodType: z.string().trim().min(1).max(60),
      instrument: z.string().trim().min(1).max(60),
      scenario: z.string().trim().min(1).max(60),
      submit: z.string().trim().min(1).max(60)
    })
  })
});

export const aiBrandSpecSchema = z
  .object({
    brand: z.object({
      displayName: z.string().trim().min(1).max(80),
      visualDirection: z.string().trim().min(1).max(600),
      contractSummary: z.string().trim().min(1).max(400),
      paletteHints: z.array(z.string().trim().min(1).max(80)).min(1).max(8)
    }),
    controls: controlsSchema,
    resourceAlias: aliasSchema,
    entities: z.object({
      register: entitySpecSchema.extend({ method: z.literal("POST"), requiresSession: z.literal(false) }),
      login: entitySpecSchema.extend({ method: z.literal("POST"), requiresSession: z.literal(false) }),
      account: entitySpecSchema.extend({ method: z.literal("GET"), requiresSession: z.literal(true) }),
      metrics: entitySpecSchema.extend({ method: z.literal("GET"), requiresSession: z.literal(true) }),
      payments: entitySpecSchema,
      customers: entitySpecSchema,
      paymentMethods: entitySpecSchema,
      balances: entitySpecSchema.extend({ method: z.literal("GET"), requiresSession: z.literal(true) })
    }),
    fields: z.object({
      payment: fieldGroupSchema,
      customer: fieldGroupSchema,
      paymentMethod: fieldGroupSchema,
      balance: fieldGroupSchema,
      account: fieldGroupSchema,
      user: fieldGroupSchema,
      metrics: fieldGroupSchema
    }),
    auth: z.object({
      tokenResponseKey: aliasSchema,
      tokenStorageKey: storageKeySchema,
      errorKey: aliasSchema,
      fields: z.object({
        email: aliasSchema,
        password: aliasSchema,
        displayName: aliasSchema,
        currency: aliasSchema
      })
    }),
    statuses: z.object(Object.fromEntries(paymentStatuses.map((status) => [status, aliasSchema])) as Record<PaymentCoreStatus, typeof aliasSchema>),
    ui: z.object({
      labels: z.object({
        register: z.string().trim().min(1).max(80),
        login: z.string().trim().min(1).max(80),
        createPayment: z.string().trim().min(1).max(80),
        history: z.string().trim().min(1).max(80),
        refund: z.string().trim().min(1).max(80),
        overview: z.string().trim().min(1).max(80),
        payments: z.string().trim().min(1).max(80),
        customers: z.string().trim().min(1).max(80),
        balances: z.string().trim().min(1).max(80)
      }),
      navigation: z.object({
        dashboard: z.string().trim().min(1).max(80),
        payments: z.string().trim().min(1).max(80),
        customers: z.string().trim().min(1).max(80),
        balances: z.string().trim().min(1).max(80)
      }),
      tableLabels: z.record(z.string().min(1), z.string().trim().min(1).max(80)),
      formLabels: z.record(z.string().min(1), z.string().trim().min(1).max(80)),
      presentation: uiPresentationSchema,
      authExperience: authExperienceSchema,
      paymentsExperience: paymentsExperienceSchema
    })
  })
  .superRefine((spec, context) => {
    const routes = Object.values(spec.entities).map((entity) => entity.route);
    const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
    for (const route of new Set(duplicates)) {
      context.addIssue({ code: "custom", path: ["entities"], message: `Duplicate public route: ${route}` });
    }

    for (const route of routes) {
      if (reservedPublicRoutes.has(route)) {
        context.addIssue({ code: "custom", path: ["entities"], message: `Reserved public route: ${route}` });
      }
    }
  });

@Injectable()
export class AiBrandSpecService {
  constructor(@Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv) {}

  normalizeControls(input?: Partial<LayoutBuilderAiGenerationControls>): LayoutBuilderAiGenerationControls {
    return {
      ...DEFAULT_AI_GENERATION_CONTROLS,
      ...(input ?? {})
    };
  }

  validateSpec(spec: unknown): { spec: LayoutBuilderAiBrandSpec | null; issues: string[] } {
    const parsed = aiBrandSpecSchema.safeParse(spec);

    if (!parsed.success) {
      return {
        spec: null,
        issues: parsed.error.issues.map((issue) => `${issue.path.join(".") || "spec"}: ${issue.message}`)
      };
    }

    return { spec: parsed.data, issues: [] };
  }

  async generateSpec(input: LayoutBuilderCreateBrandDraftRequest, messages: LayoutBuilderBrandGenerationMessage[]): Promise<LayoutBuilderAiBrandSpec> {
    const provider = input.provider ?? (this.config.BRAND_AI_PROVIDER as LayoutBuilderAiProvider);
    const controls = this.normalizeControls(input.controls);

    if (provider === "gemini" && this.config.GEMINI_ENABLED && this.config.GEMINI_API_KEY) {
      return this.generateGeminiSpec(input, messages, controls);
    }

    return this.localSpec(input, messages, controls);
  }

  private async generateGeminiSpec(
    input: LayoutBuilderCreateBrandDraftRequest,
    messages: LayoutBuilderBrandGenerationMessage[],
    controls: LayoutBuilderAiGenerationControls
  ): Promise<LayoutBuilderAiBrandSpec> {
    const model = input.model?.trim() || this.config.GEMINI_MODEL;
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.config.GEMINI_API_KEY ?? ""
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: [
                    input.systemPrompt?.trim() || DEFAULT_BRAND_AI_SYSTEM_PROMPT,
                    specPrompt(input.brandName, input.adminPrompt, controls, messages)
                  ].join("\n\n")
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: GEMINI_BRAND_SPEC_RESPONSE_SCHEMA,
            temperature: 0.7
          }
        })
      }
    );

    if (!response.ok) {
      throw new BadRequestException(`Gemini brand spec generation failed: ${await response.text()}`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const text = extractGeminiText(body);
    const validation = this.validateSpec(JSON.parse(stripJsonFence(text)));

    if (!validation.spec) {
      throw new BadRequestException({ message: "Gemini returned an invalid brand spec", issues: validation.issues });
    }

    return validation.spec;
  }

  private localSpec(
    input: LayoutBuilderCreateBrandDraftRequest,
    messages: LayoutBuilderBrandGenerationMessage[],
    controls: LayoutBuilderAiGenerationControls
  ): LayoutBuilderAiBrandSpec {
    const seed = hashToNumber(`${input.brandName}:${input.adminPrompt}:${messages.map((message) => message.content).join("|")}`);
    const vocabulary = pick(LOCAL_VOCABULARIES, seed);
    const style = controls.fieldStyle;
    const field = (value: string) => style === "camelCase" ? toCamel(value) : style === "kebab-case" ? value.replaceAll("_", "-") : value;

    return {
      brand: {
        displayName: input.brandName,
        visualDirection: `${vocabulary.visual}. ${controls.namingIntensity} naming variation.`,
        contractSummary: `${input.brandName} exposes ${vocabulary.resourceAlias} through AI-authored routes and payloads.`,
        paletteHints: [...vocabulary.paletteHints]
      },
      controls,
      resourceAlias: field(vocabulary.resourceAlias),
      entities: {
        register: entity(vocabulary.register, "POST", false, "accessRequest", "accessResult"),
        login: entity(vocabulary.login, "POST", false, "sessionRequest", "sessionResult"),
        account: entity(vocabulary.account, "GET", true, "accountRequest", "accountRecord"),
        metrics: entity(vocabulary.metrics, "GET", true, "metricsRequest", "metricsRecord"),
        payments: entity(vocabulary.payments, "GET", true, "paymentRequest", field(vocabulary.resourceAlias)),
        customers: entity(vocabulary.customers, "GET", true, "customerRequest", vocabulary.customerKey),
        paymentMethods: entity(vocabulary.paymentMethods, "GET", true, "methodRequest", vocabulary.methodKey),
        balances: entity(vocabulary.balances, "GET", true, "balanceRequest", vocabulary.balanceKey)
      },
      fields: {
        payment: mapFields(field, {
          paymentId: "case_ref",
          externalReference: "merchant_marker",
          paymentIntentId: "routing_ref",
          customerId: "party_ref",
          paymentMethodId: "source_ref",
          status: "lifecycle",
          amount: "gross_value",
          currency: "value_unit",
          destinationLabel: "counterparty_note",
          methodType: "funding_kind",
          createdAt: "opened_at"
        }),
        customer: mapFields(field, { customerId: "party_ref", email: "party_mail", name: "party_name", phone: "party_line" }),
        paymentMethod: mapFields(field, {
          paymentMethodId: "source_ref",
          type: "source_kind",
          label: "source_label",
          last4: "source_tail",
          brand: "source_network",
          expiryMonth: "valid_month",
          expiryYear: "valid_year",
          bankName: "institution_label"
        }),
        balance: mapFields(field, {
          balanceTransactionId: "posting_ref",
          paymentId: "source_case",
          type: "posting_kind",
          amount: "posted_value",
          currency: "posting_unit",
          description: "posting_note",
          createdAt: "posted_at"
        }),
        account: mapFields(field, { accountId: "workspace_ref", balance: "available_float", currency: "home_unit" }),
        user: mapFields(field, { userId: "operator_ref", email: "operator_mail", displayName: "operator_label" }),
        metrics: mapFields(field, { count: "case_count", volume: "gross_flow", customers: "party_count", review: "review_queue", currency: "home_unit" })
      },
      auth: {
        tokenResponseKey: field(vocabulary.tokenKey),
        tokenStorageKey: `session:${field(vocabulary.resourceAlias)}`,
        errorKey: field("access_error"),
        fields: mapFields(field, {
          email: "access_mail",
          password: "access_secret",
          displayName: "operator_label",
          currency: "home_unit"
        }) as LayoutBuilderAiBrandSpec["auth"]["fields"]
      },
      statuses: vocabulary.statuses,
      ui: {
        labels: vocabulary.labels,
        navigation: vocabulary.navigation,
        tableLabels: vocabulary.tableLabels,
        formLabels: vocabulary.formLabels,
        authExperience: localAuthExperience(input.brandName, vocabulary),
        paymentsExperience: localPaymentsExperience(input.brandName, vocabulary),
        presentation: {
          layout: vocabulary.layout,
          density: vocabulary.density,
          navigationPattern: vocabulary.navigationPattern,
          dashboardComposition: [...vocabulary.dashboardComposition],
          visualTokens: {
            palette: [...vocabulary.paletteHints],
            typography: vocabulary.typography,
            radius: vocabulary.radius,
            spacing: vocabulary.spacing,
            surfaces: vocabulary.surfaces,
            buttons: vocabulary.buttons
          },
          copyTone: vocabulary.copyTone,
          componentLabels: vocabulary.componentLabels,
          emptyStates: vocabulary.emptyStates
        }
      }
    };
  }
}

function entity(route: string, method: "GET" | "POST", requiresSession: boolean, requestKey: string, responseKey: string) {
  return { route, method, requiresSession, requestKey, responseKey, emptyState: "No activity loaded yet." };
}

function mapFields(field: (value: string) => string, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, field(value)]));
}

function specPrompt(
  brandName: string,
  adminPrompt: string,
  controls: LayoutBuilderAiGenerationControls,
  messages: LayoutBuilderBrandGenerationMessage[]
): string {
  return [
    `Brand name: ${brandName}`,
    `Admin brief: ${adminPrompt}`,
    `Generation controls: ${JSON.stringify(controls)}`,
    "Return only JSON matching the brand runtime spec. Do not wrap it in markdown.",
    "Required top-level keys: brand, controls, resourceAlias, entities, fields, auth, statuses, ui.",
    "Every alias, route, label, status value, response key, request key, and empty-state value must be a plain string scalar. Never return objects for those values.",
    "Required entities: register, login, account, metrics, payments, customers, paymentMethods, balances.",
    `Required statuses: ${paymentStatuses.join(", ")}.`,
    "Routes must be slug-only path segments without a leading slash, for example vault-door or pulse-feed. Never return /vault-door, URLs, query strings, or multi-segment paths.",
    "Use unique route slugs and field aliases. Do not use profile, bff, runtime, rest-api, account, accounts, payments, customers, payment-methods, payment_methods, balances, or metrics as routes.",
    "Every entity must include route, method, requiresSession, requestKey, responseKey, and emptyState.",
    "controls.responseEnvelope is applied to public BFF JSON shape. Pick it intentionally so one brand may return a direct resource, another a named resource object, another a data envelope, and another a result envelope.",
    "register and login must have requiresSession false. account, metrics, payments, customers, paymentMethods, and balances must have requiresSession true.",
    "Auth must include tokenResponseKey, tokenStorageKey, errorKey, and fields for email/password/displayName/currency.",
    "ui must include labels, navigation, tableLabels, formLabels, and presentation.",
    "ui must include authExperience. This is the main source of truth for the login/register screen, not a template name.",
    "ui must include paymentsExperience. This is the main source of truth for the seeded payments page, not a template name.",
    `ui.presentation.layout must be one of: ${AI_UI_LAYOUTS.join(", ")}.`,
    `ui.presentation.dashboardComposition must use only: ${AI_DASHBOARD_BLOCKS.join(", ")}.`,
    "ui.presentation must make visual layout, density, navigation, palette, typography, surfaces, buttons, copy tone, component labels, and empty states unique for this brand.",
    "ui.presentation.visualTokens.palette must have real contrast: one dark anchor, one light surface, and at least one vivid accent from a different hue family. Avoid nearby green/teal-only palettes unless the brief explicitly requires them.",
    "ui.authExperience must define content, composition frame, brand treatment, numeric layout values, form field copy, mode control, field treatment, surface treatment, and short visual direction strings. Do not expose route slugs, field aliases, token keys, internal service names, or implementation details in authExperience.",
    "ui.paymentsExperience must define a production payment table, not cards or timeline: composition.activityPattern must be table, table.columns must contain 4-7 brand-specific columns, table title/controls/density should vary, and the table must stay visually primary over metrics and create-payment controls. content.description is metadata only and should not be written like repeated hero copy.",
    "Conversation:",
    ...messages.map((message) => `${message.role}: ${message.content}`)
  ].join("\n");
}

function extractGeminiText(body: Record<string, unknown>): string {
  const candidates = Array.isArray(body.candidates) ? body.candidates : [];
  for (const candidate of candidates) {
    const content = candidate && typeof candidate === "object" && "content" in candidate ? (candidate as { content?: unknown }).content : null;
    const parts = content && typeof content === "object" && "parts" in content ? (content as { parts?: unknown }).parts : null;
    if (!Array.isArray(parts)) {
      continue;
    }
    for (const part of parts) {
      if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text;
      }
    }
  }

  throw new BadRequestException("Gemini response did not include JSON text output");
}

function stripJsonFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}

function hashToNumber(value: string): number {
  return Number.parseInt(createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
}

function toCamel(value: string): string {
  return value
    .split("_")
    .map((part, index) => (index === 0 ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
    .join("");
}

function localAuthExperience(brandName: string, vocabulary: (typeof LOCAL_VOCABULARIES)[number]): LayoutBuilderAiBrandSpec["ui"]["authExperience"] {
  const layout = vocabulary.layout as LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"];
  const density = vocabulary.density as LayoutBuilderAiBrandSpec["ui"]["presentation"]["density"];
  const navigationPattern = vocabulary.navigationPattern as LayoutBuilderAiBrandSpec["ui"]["presentation"]["navigationPattern"];
  const isCompact = density === "compact";
  const isDark = layout === "command-center" || layout === "compact-terminal";

  return {
    content: {
      headline: brandName,
      description: vocabulary.visual
    },
    composition: {
      frame: layout === "compact-terminal" ? "console" : layout === "command-center" ? "centered" : layout === "topbar-console" ? "offset" : "split",
      brandTreatment: layout === "topbar-console" ? "inline" : isCompact ? "badge" : "stacked",
      showDescription: layout !== "compact-terminal"
    },
    layout: {
      brandColumn: layout === "split-workspace" ? 44 : layout === "card-operations" ? 52 : 48,
      formMaxWidth: isCompact ? 380 : 440,
      logoSize: isCompact ? 64 : 84,
      panelPadding: isCompact ? 16 : 22,
      gap: isCompact ? 22 : 32,
      brandAlignment: layout === "command-center" ? "center" : "start",
      formAlignment: layout === "compact-terminal" ? "start" : "center",
      textAlign: layout === "command-center" ? "center" : "left",
      mobileOrder: layout === "compact-terminal" ? "form-first" : "brand-first"
    },
    form: {
      modeControl: navigationPattern === "top-tabs" ? "tabs" : layout === "compact-terminal" ? "toggle" : "segmented",
      fieldTreatment: isCompact ? "underlined" : isDark ? "filled" : "boxed",
      surface: isDark ? "outlined" : "raised",
      showDisplayNameOnLogin: false,
      fields: {
        email: { label: "Email", placeholder: "client@example.com" },
        password: { label: "Password", placeholder: "local-demo-password" },
        displayName: { label: "Display name", placeholder: `${brandName} operator` }
      }
    },
    visual: {
      background: vocabulary.surfaces,
      panel: vocabulary.buttons,
      accent: vocabulary.copyTone
    }
  };
}

function localPaymentsExperience(brandName: string, vocabulary: (typeof LOCAL_VOCABULARIES)[number]): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"] {
  const layout = vocabulary.layout as LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"];
  const density = vocabulary.density as LayoutBuilderAiBrandSpec["ui"]["presentation"]["density"];
  const isCompact = density === "compact";
  const cardLike = layout === "card-operations";
  const formLabels: Record<string, string | undefined> = vocabulary.formLabels;

  return {
    content: {
      headline: vocabulary.labels.payments,
      description: `${brandName} presents ${vocabulary.resourceAlias.replaceAll("_", " ")} as ${vocabulary.copyTone}.`,
      emptyState: vocabulary.emptyStates.payments
    },
    composition: {
      metricsPlacement: layout === "split-workspace" ? "left" : layout === "card-operations" ? "right" : "top",
      activityPattern: "table",
      statusTreatment: layout === "compact-terminal" ? "dot" : cardLike ? "rail" : "badge",
      amountEmphasis: isCompact ? "secondary" : cardLike ? "primary" : "balanced",
      showCustomer: true,
      showMethod: !isCompact,
      showTimestamp: true,
      maxItems: isCompact ? 12 : 10
    },
    layout: {
      metricsColumns: layout === "topbar-console" ? 4 : cardLike ? 2 : 3,
      sidebarWidth: isCompact ? 220 : 280,
      cardMinWidth: cardLike ? 260 : 220,
      gap: isCompact ? 12 : 18,
      panelPadding: isCompact ? 12 : 16,
      rowMinHeight: isCompact ? 54 : 68
    },
    table: localPaymentTable(vocabulary, layout, density),
    visual: {
      surface: vocabulary.surfaces,
      status: vocabulary.buttons,
      dataDensity: vocabulary.spacing
    },
    createPayment: {
      enabled: true,
      placement: cardLike ? "sidecar" : isCompact ? "activity-bottom" : "activity-top",
      surface: isCompact ? "compact" : cardLike ? "panel" : "inline",
      tone: cardLike ? "guided" : "operator",
      defaultScenario: "settle",
      labels: {
        title: vocabulary.labels.createPayment,
        amount: formLabels.amount ?? "Amount",
        currency: formLabels.currency ?? "Currency",
        customer: formLabels.customer ?? "Customer",
        customerEmail: formLabels.customerEmail ?? "Customer email",
        methodType: formLabels.methodType ?? formLabels.method ?? "Payment source",
        instrument: formLabels.instrumentReference ?? "Card or account",
        scenario: formLabels.scenario ?? "Processing route",
        submit: vocabulary.labels.createPayment
      }
    }
  };
}

function localPaymentTable(
  vocabulary: (typeof LOCAL_VOCABULARIES)[number],
  layout: LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"],
  density: LayoutBuilderAiBrandSpec["ui"]["presentation"]["density"]
): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"] {
  const labels = vocabulary.tableLabels;
  const columnsByLayout: Record<
    LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"],
    Array<LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"][number]["key"]>
  > = {
    "sidebar-ledger": ["reference", "status", "amount", "customer", "method", "createdAt"],
    "topbar-console": ["status", "reference", "customer", "destination", "amount", "method", "createdAt"],
    "split-workspace": ["reference", "customer", "method", "status", "amount", "createdAt"],
    "command-center": ["status", "createdAt", "reference", "amount", "customer"],
    "card-operations": ["reference", "customer", "amount", "status", "destination"],
    "compact-terminal": ["createdAt", "reference", "status", "amount", "method"]
  };
  const labelByKey: Record<LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"][number]["key"], string> = {
    reference: labels.id ?? "Payment",
    status: labels.status ?? "State",
    amount: labels.amount ?? "Amount",
    customer: labels.customer ?? "Customer",
    method: "Source",
    createdAt: labels.createdAt ?? "Created",
    destination: "Destination"
  };

  return {
    titlePlacement: layout === "topbar-console" || layout === "compact-terminal" ? "hidden" : layout === "command-center" ? "page" : "table",
    controlsPlacement: layout === "split-workspace" || layout === "card-operations" ? "side" : layout === "compact-terminal" || layout === "command-center" ? "none" : "above",
    density: density === "compact" ? "compact" : density === "spacious" ? "spacious" : "regular",
    columns: columnsByLayout[layout].map((key, index) => ({
      key,
      label: labelByKey[key],
      priority: index + 1
    }))
  };
}

const LOCAL_VOCABULARIES = [
  {
    resourceAlias: "settlement_cases",
    visual: "Dense merchant settlement console with compact ledgers and clear risk states",
    paletteHints: ["deep violet", "white surface", "magenta accent"],
    register: "join-console",
    login: "enter-desk",
    account: "me",
    metrics: "pulse",
    payments: "case-ledger",
    customers: "party-book",
    paymentMethods: "source-vault",
    balances: "float-feed",
    customerKey: "parties",
    methodKey: "sources",
    balanceKey: "postings",
    tokenKey: "deskToken",
    statuses: {
      created: "caseOpened",
      requires_payment_method: "sourceNeeded",
      requires_confirmation: "approvalNeeded",
      processing: "routing",
      authorized: "reservePlaced",
      captured: "fundsCaptured",
      settled: "caseCleared",
      failed: "caseRejected",
      canceled: "caseVoided",
      refunded: "caseReturned"
    },
    labels: {
      register: "Open console",
      login: "Enter desk",
      createPayment: "Create case",
      history: "Case ledger",
      refund: "Return funds",
      overview: "Pulse",
      payments: "Settlement cases",
      customers: "Parties",
      balances: "Float feed"
    },
    navigation: { dashboard: "Pulse", payments: "Cases", customers: "Parties", balances: "Float" },
    tableLabels: { id: "Case", status: "Lifecycle", amount: "Gross", customer: "Party", createdAt: "Opened" },
    formLabels: { amount: "Gross value", customer: "Party", method: "Source" },
    layout: "sidebar-ledger",
    density: "compact",
    navigationPattern: "sidebar",
    dashboardComposition: ["metrics", "recentPayments", "balances", "customers", "createPayment"],
    typography: "condensed operational sans with compact numeric emphasis",
    radius: "6px",
    spacing: "tight ledger rhythm",
    surfaces: "white panels with violet left rail and light audit borders",
    buttons: "solid violet primary actions with quiet secondary controls",
    copyTone: "audit-focused settlement operations language",
    componentLabels: { metricsCard: "Settlement pulse", paymentTable: "Case register", createPanel: "Open settlement case" },
    emptyStates: { payments: "No settlement cases are queued.", customers: "No parties are loaded.", balances: "No float postings yet." }
  },
  {
    resourceAlias: "treasury_moves",
    visual: "Premium treasury movement workspace with balance-first language",
    paletteHints: ["forest", "white", "amber"],
    register: "activate-workspace",
    login: "resume-vault",
    account: "wallet",
    metrics: "signals",
    payments: "movement-book",
    customers: "counterparties",
    paymentMethods: "rails",
    balances: "treasury",
    customerKey: "counterparties",
    methodKey: "rails",
    balanceKey: "movements",
    tokenKey: "vaultToken",
    statuses: {
      created: "moveDrafted",
      requires_payment_method: "railMissing",
      requires_confirmation: "approvalQueue",
      processing: "inFlight",
      authorized: "held",
      captured: "debited",
      settled: "posted",
      failed: "blocked",
      canceled: "withdrawn",
      refunded: "reversed"
    },
    labels: {
      register: "Activate workspace",
      login: "Resume vault",
      createPayment: "Route move",
      history: "Movement book",
      refund: "Reverse move",
      overview: "Signals",
      payments: "Treasury moves",
      customers: "Counterparties",
      balances: "Treasury"
    },
    navigation: { dashboard: "Signals", payments: "Moves", customers: "Parties", balances: "Treasury" },
    tableLabels: { id: "Move", status: "State", amount: "Value", customer: "Counterparty", createdAt: "Booked" },
    formLabels: { amount: "Move value", customer: "Counterparty", method: "Rail" },
    layout: "topbar-console",
    density: "balanced",
    navigationPattern: "top-tabs",
    dashboardComposition: ["metrics", "balances", "recentPayments", "customers"],
    typography: "modern finance sans with tabular figures",
    radius: "8px",
    spacing: "balanced treasury workspace spacing",
    surfaces: "soft green-tinted surfaces with amber review accents",
    buttons: "forest primary actions with amber attention states",
    copyTone: "premium treasury movement language",
    componentLabels: { metricsCard: "Treasury signals", paymentTable: "Movement book", createPanel: "Route treasury move" },
    emptyStates: { payments: "No treasury moves are booked.", customers: "No counterparties are active.", balances: "No treasury postings yet." }
  },
  {
    resourceAlias: "orbit_flows",
    visual: "Wide top-tab merchant console with orbit-style payment streams and spacious operational cards",
    paletteHints: ["navy", "cyan", "amber", "white", "slate"],
    register: "open-orbit",
    login: "return-orbit",
    account: "crew-wallet",
    metrics: "orbit-pulse",
    payments: "flow-board",
    customers: "client-orbits",
    paymentMethods: "rail-array",
    balances: "fuel-gauge",
    customerKey: "orbitClients",
    methodKey: "railArray",
    balanceKey: "fuelLines",
    tokenKey: "orbitToken",
    statuses: {
      created: "flowDrafted",
      requires_payment_method: "railMissing",
      requires_confirmation: "captainCheck",
      processing: "inOrbit",
      authorized: "holdLocked",
      captured: "cargoCaptured",
      settled: "orbitLanded",
      failed: "signalDropped",
      canceled: "courseAborted",
      refunded: "cargoReturned"
    },
    labels: {
      register: "Open orbit",
      login: "Return orbit",
      createPayment: "Launch flow",
      history: "Flow board",
      refund: "Return cargo",
      overview: "Orbit pulse",
      payments: "Orbit flows",
      customers: "Client orbits",
      balances: "Fuel gauge"
    },
    navigation: { dashboard: "Pulse", payments: "Flows", customers: "Orbits", balances: "Fuel" },
    tableLabels: { id: "Flow", status: "Orbit state", amount: "Cargo value", customer: "Client orbit", createdAt: "Launched" },
    formLabels: { amount: "Cargo value", customer: "Client orbit", method: "Rail array" },
    layout: "topbar-console",
    density: "spacious",
    navigationPattern: "top-tabs",
    dashboardComposition: ["metrics", "balances", "recentPayments", "createPayment"],
    typography: "airy geometric finance sans with tabular figures",
    radius: "10px",
    spacing: "open console spacing with clear tab groups",
    surfaces: "white command surfaces over a navy and cyan navigation bar",
    buttons: "cyan primary actions with amber review emphasis",
    copyTone: "calm orbital payment operations language",
    componentLabels: { metricsCard: "Orbit pulse", paymentTable: "Flow board", createPanel: "Launch payment flow" },
    emptyStates: { payments: "No orbit flows are launched.", customers: "No client orbits are mapped.", balances: "No fuel gauge postings yet." }
  },
  {
    resourceAlias: "vault_signals",
    visual: "Dark command-center payment desk with collapsible rail groups and risk-first signal language",
    paletteHints: ["midnight", "teal", "signal green", "white", "ink"],
    register: "claim-vault",
    login: "unlock-vault",
    account: "operator-seat",
    metrics: "signal-grid",
    payments: "control-lane",
    customers: "identity-map",
    paymentMethods: "rail-locker",
    balances: "reserve-watch",
    customerKey: "identities",
    methodKey: "lockedRails",
    balanceKey: "reserveSignals",
    tokenKey: "vaultSignalToken",
    statuses: {
      created: "signalOpened",
      requires_payment_method: "railUnverified",
      requires_confirmation: "operatorHold",
      processing: "signalRouting",
      authorized: "reserveSecured",
      captured: "valueCaptured",
      settled: "signalCleared",
      failed: "signalDenied",
      canceled: "signalClosed",
      refunded: "reserveReleased"
    },
    labels: {
      register: "Claim vault",
      login: "Unlock vault",
      createPayment: "Route signal",
      history: "Control lane",
      refund: "Release reserve",
      overview: "Signal grid",
      payments: "Vault signals",
      customers: "Identity map",
      balances: "Reserve watch"
    },
    navigation: { dashboard: "Grid", payments: "Signals", customers: "Map", balances: "Reserve" },
    tableLabels: { id: "Signal", status: "Control state", amount: "Reserve", customer: "Identity", createdAt: "Opened" },
    formLabels: { amount: "Reserve value", customer: "Identity", method: "Locked rail" },
    layout: "command-center",
    density: "compact",
    navigationPattern: "command-rail",
    dashboardComposition: ["metrics", "recentPayments", "balances", "createPayment"],
    typography: "compact mono-adjacent operations sans with dense figures",
    radius: "4px",
    spacing: "tight command spacing with grouped rail controls",
    surfaces: "dark panels with teal borders and signal-green highlights",
    buttons: "teal command buttons with restrained signal states",
    copyTone: "security-led payment command language",
    componentLabels: { metricsCard: "Signal grid", paymentTable: "Control lane", createPanel: "Route vault signal" },
    emptyStates: { payments: "No vault signals are active.", customers: "No identities are mapped.", balances: "No reserve signals yet." }
  },
  {
    resourceAlias: "receipt_threads",
    visual: "Card-operations workspace with receipt-thread language, short menus, and retail payment review cards",
    paletteHints: ["charcoal", "orange", "cyan", "white"],
    register: "start-counter",
    login: "return-counter",
    account: "station-record",
    metrics: "till-signals",
    payments: "receipt-stream",
    customers: "buyer-file",
    paymentMethods: "tender-drawer",
    balances: "cash-ledger",
    customerKey: "buyerFiles",
    methodKey: "tenderDrawer",
    balanceKey: "cashLines",
    tokenKey: "counterToken",
    statuses: {
      created: "ticketOpened",
      requires_payment_method: "tenderNeeded",
      requires_confirmation: "managerCheck",
      processing: "ticketRunning",
      authorized: "amountHeld",
      captured: "tenderCaptured",
      settled: "receiptClosed",
      failed: "ticketDeclined",
      canceled: "ticketVoided",
      refunded: "receiptReturned"
    },
    labels: {
      register: "Start counter",
      login: "Return counter",
      createPayment: "Write receipt",
      history: "Receipt stream",
      refund: "Return receipt",
      overview: "Till signals",
      payments: "Receipt threads",
      customers: "Buyer file",
      balances: "Cash ledger"
    },
    navigation: { dashboard: "Signals", payments: "Receipts", customers: "Buyers", balances: "Cash" },
    tableLabels: { id: "Receipt", status: "Ticket state", amount: "Tender", customer: "Buyer", createdAt: "Written" },
    formLabels: { amount: "Tender value", customer: "Buyer", method: "Tender drawer" },
    layout: "card-operations",
    density: "balanced",
    navigationPattern: "sidebar",
    dashboardComposition: ["metrics", "createPayment", "recentPayments", "customers"],
    typography: "humanist operations sans with readable retail figures",
    radius: "8px",
    spacing: "balanced card spacing for repeated counter work",
    surfaces: "white receipt cards with charcoal text and cyan dividers",
    buttons: "orange primary payment actions with quiet charcoal secondary states",
    copyTone: "retail payment operations language",
    componentLabels: { metricsCard: "Till signals", paymentTable: "Receipt stream", createPanel: "Write receipt thread" },
    emptyStates: { payments: "No receipt threads are written.", customers: "No buyer files are saved.", balances: "No cash ledger entries yet." }
  }
] as const;

const GEMINI_BRAND_SPEC_RESPONSE_SCHEMA = objectSchema({
  brand: objectSchema({
    displayName: stringSchema(),
    visualDirection: stringSchema(),
    contractSummary: stringSchema(),
    paletteHints: arraySchema(stringSchema())
  }),
  controls: objectSchema({
    payloadStructure: enumSchema(["flat", "nested", "key-value-array"]),
    fieldStyle: enumSchema(["camelCase", "snake_case", "kebab-case"]),
    authShape: enumSchema(["credentials", "access_key", "workspace"]),
    responseEnvelope: enumSchema(["plain", "resource_key", "data", "result"]),
    routeNaming: enumSchema(["product", "finance", "abstract"]),
    errorStyle: enumSchema(["standard", "branded"]),
    namingIntensity: enumSchema(["moderate", "high", "maximum"])
  }),
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
    payment: fieldGroupSchemaFor([
      "paymentId",
      "externalReference",
      "paymentIntentId",
      "customerId",
      "paymentMethodId",
      "status",
      "amount",
      "currency",
      "destinationLabel",
      "methodType",
      "createdAt"
    ]),
    customer: fieldGroupSchemaFor(["customerId", "email", "name", "phone"]),
    paymentMethod: fieldGroupSchemaFor([
      "paymentMethodId",
      "type",
      "label",
      "last4",
      "brand",
      "expiryMonth",
      "expiryYear",
      "bankName"
    ]),
    balance: fieldGroupSchemaFor(["balanceTransactionId", "paymentId", "type", "amount", "currency", "description", "createdAt"]),
    account: fieldGroupSchemaFor(["accountId", "balance", "currency"]),
    user: fieldGroupSchemaFor(["userId", "email", "displayName"]),
    metrics: fieldGroupSchemaFor(["count", "volume", "customers", "review", "currency"])
  }),
  auth: objectSchema({
    tokenResponseKey: stringSchema(),
    tokenStorageKey: stringSchema(),
    errorKey: stringSchema(),
    fields: objectSchema({
      email: stringSchema(),
      password: stringSchema(),
      displayName: stringSchema(),
      currency: stringSchema()
    })
  }),
  statuses: objectSchema(Object.fromEntries(paymentStatuses.map((status) => [status, stringSchema()]))),
  ui: objectSchema({
    labels: objectSchema({
      register: stringSchema(),
      login: stringSchema(),
      createPayment: stringSchema(),
      history: stringSchema(),
      refund: stringSchema(),
      overview: stringSchema(),
      payments: stringSchema(),
      customers: stringSchema(),
      balances: stringSchema()
    }),
    navigation: objectSchema({
      dashboard: stringSchema(),
      payments: stringSchema(),
      customers: stringSchema(),
      balances: stringSchema()
    }),
    tableLabels: fieldGroupSchemaFor(["id", "status", "amount", "customer", "createdAt"]),
    formLabels: fieldGroupSchemaFor(["amount", "customer", "method"]),
    authExperience: objectSchema({
      content: objectSchema({
        headline: stringSchema(),
        description: stringSchema()
      }),
      composition: objectSchema({
        frame: enumSchema(["split", "centered", "offset", "console", "minimal"]),
        brandTreatment: enumSchema(["stacked", "inline", "badge"]),
        showDescription: { type: "boolean" }
      }),
      layout: objectSchema({
        brandColumn: { type: "integer" },
        formMaxWidth: { type: "integer" },
        logoSize: { type: "integer" },
        panelPadding: { type: "integer" },
        gap: { type: "integer" },
        brandAlignment: enumSchema(AI_AUTH_ALIGNMENTS),
        formAlignment: enumSchema(AI_AUTH_ALIGNMENTS),
        textAlign: enumSchema(AI_AUTH_TEXT_ALIGNMENTS),
        mobileOrder: enumSchema(AI_AUTH_MOBILE_ORDERS)
      }),
      form: objectSchema({
        modeControl: enumSchema(AI_AUTH_MODE_CONTROLS),
        fieldTreatment: enumSchema(AI_AUTH_FIELD_TREATMENTS),
        surface: enumSchema(AI_AUTH_SURFACES),
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
    }),
    paymentsExperience: objectSchema({
      content: objectSchema({
        headline: stringSchema(),
        description: stringSchema(),
        emptyState: stringSchema()
      }),
      composition: objectSchema({
        metricsPlacement: enumSchema(AI_PAYMENTS_METRICS_PLACEMENTS),
        activityPattern: enumSchema(AI_PAYMENTS_ACTIVITY_PATTERNS),
        statusTreatment: enumSchema(AI_PAYMENTS_STATUS_TREATMENTS),
        amountEmphasis: enumSchema(AI_PAYMENTS_AMOUNT_EMPHASIS),
        showCustomer: { type: "boolean" },
        showMethod: { type: "boolean" },
        showTimestamp: { type: "boolean" },
        maxItems: { type: "integer" }
      }),
      layout: objectSchema({
        metricsColumns: { type: "integer" },
        sidebarWidth: { type: "integer" },
        cardMinWidth: { type: "integer" },
        gap: { type: "integer" },
        panelPadding: { type: "integer" },
        rowMinHeight: { type: "integer" }
      }),
      table: objectSchema({
        titlePlacement: enumSchema(AI_PAYMENTS_TABLE_TITLE_PLACEMENTS),
        controlsPlacement: enumSchema(AI_PAYMENTS_TABLE_CONTROL_PLACEMENTS),
        density: enumSchema(AI_PAYMENTS_TABLE_DENSITIES),
        columns: arraySchema(
          objectSchema({
            key: enumSchema(AI_PAYMENTS_TABLE_COLUMN_KEYS),
            label: stringSchema(),
            priority: { type: "integer" }
          })
        )
      }),
      visual: objectSchema({
        surface: stringSchema(),
        status: stringSchema(),
        dataDensity: stringSchema()
      }),
      createPayment: objectSchema({
        enabled: { type: "boolean" },
        placement: enumSchema(AI_PAYMENTS_COMPOSER_PLACEMENTS),
        surface: enumSchema(AI_PAYMENTS_COMPOSER_SURFACES),
        tone: enumSchema(AI_PAYMENTS_COMPOSER_TONES),
        defaultScenario: enumSchema(AI_PAYMENT_SCENARIOS),
        labels: objectSchema({
          title: stringSchema(),
          amount: stringSchema(),
          currency: stringSchema(),
          customer: stringSchema(),
          customerEmail: stringSchema(),
          methodType: stringSchema(),
          instrument: stringSchema(),
          scenario: stringSchema(),
          submit: stringSchema()
        })
      })
    }),
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
      componentLabels: fieldGroupSchemaFor(["metricsCard", "paymentTable", "createPanel", "customerPanel", "balancePanel"]),
      emptyStates: fieldGroupSchemaFor(["payments", "customers", "balances"])
    })
  })
});

function objectSchema(properties: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "object",
    required: Object.keys(properties),
    properties
  };
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

function fieldGroupSchemaFor(keys: readonly string[]): Record<string, unknown> {
  return objectSchema(Object.fromEntries(keys.map((key) => [key, stringSchema()])));
}
