import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiBrandSpec,
  LayoutBuilderAiDashboardBlock,
  LayoutBuilderDeepPartial,
  LayoutBuilderAiGenerationControls,
  LayoutBuilderBrandGenerationIntent,
  LayoutBuilderFieldStyle,
  PaymentCoreStatus
} from "@payment-ops/shared-types";

import {
  AI_DASHBOARD_BLOCKS,
  AI_UI_DENSITIES,
  AI_UI_LAYOUTS,
  AI_UI_NAVIGATION_PATTERNS,
  DEFAULT_AI_GENERATION_CONTROLS,
  PAYMENT_STATUSES,
  RESERVED_PUBLIC_ROUTES
} from "./ai-brand-spec.service.js";

@Injectable()
export class BrandIntentCompilerService {
  compile(
    intent: LayoutBuilderBrandGenerationIntent,
    controls: Partial<LayoutBuilderAiGenerationControls> = {}
  ): LayoutBuilderAiBrandSpec {
    const normalizedControls = normalizeControls(intent, controls);
    const field = fieldFormatter(normalizedControls.fieldStyle);
    const terms = intentTerms(intent);
    const routes = routeFactory(terms, intent);
    const resourceAlias = field(`${terms.payment}_items`);
    const presentation = visualSystem(intent, normalizedControls);

    return {
      brand: {
        displayName: intent.brandName,
        visualDirection: [
          `${intent.brandName} gives ${intent.concept.audience} a focused payment workspace for ${intent.concept.paymentMetaphor}, balances, and customer activity.`,
          `${intent.concept.productMetaphor} language keeps the product distinct while the interface stays readable for daily merchant operations.`
        ].join(" "),
        contractSummary: `${intent.brandName} brings payment intake, review, settlement, and customer records into a focused merchant workspace.`,
        paletteHints: presentation.palette
      },
      controls: normalizedControls,
      resourceAlias,
      entities: {
        register: entity(routes.next("register", [intent.concept.authMetaphor, "start"]), "POST", false, field(`${terms.auth}_request`), field(`${terms.auth}_grant`), empty(intent, "register")),
        login: entity(routes.next("login", [intent.concept.authMetaphor, "enter"]), "POST", false, field(`${terms.auth}_check`), field(`${terms.auth}_session`), empty(intent, "login")),
        account: entity(routes.next("account", [intent.concept.authMetaphor, "seat"]), "GET", true, field(`${terms.auth}_lookup`), field(`${terms.auth}_record`), empty(intent, "account")),
        metrics: entity(routes.next("metrics", [intent.concept.productMetaphor, "pulse"]), "GET", true, field(`${terms.product}_scope`), field(`${terms.product}_signals`), empty(intent, "metrics")),
        payments: entity(routes.next("payments", paymentRouteParts(intent, terms, presentation)), "GET", true, field(`${terms.payment}_filter`), resourceAlias, empty(intent, "payments")),
        customers: entity(routes.next("customers", [terms.audience, "book"]), "GET", true, field(`${terms.audience}_filter`), field(`${terms.audience}_records`), empty(intent, "customers")),
        paymentMethods: entity(routes.next("paymentMethods", [terms.rail, "vault"]), "GET", true, field(`${terms.rail}_filter`), field(`${terms.rail}_records`), empty(intent, "paymentMethods")),
        balances: entity(routes.next("balances", [terms.reserve, "stream"]), "GET", true, field(`${terms.reserve}_scope`), field(`${terms.reserve}_entries`), empty(intent, "balances"))
      },
      fields: {
        payment: mapFields(field, paymentFields(terms)),
        customer: mapFields(field, {
          customerId: `${terms.audience}_ref`,
          email: `${terms.audience}_mail`,
          name: `${terms.audience}_label`,
          phone: `${terms.audience}_line`
        }),
        paymentMethod: mapFields(field, {
          paymentMethodId: `${terms.rail}_ref`,
          type: `${terms.rail}_kind`,
          label: `${terms.rail}_label`,
          last4: `${terms.rail}_tail`,
          brand: `${terms.rail}_network`,
          expiryMonth: `${terms.rail}_month`,
          expiryYear: `${terms.rail}_year`,
          bankName: `${terms.rail}_institution`
        }),
        balance: mapFields(field, {
          balanceTransactionId: `${terms.reserve}_ref`,
          paymentId: `${terms.payment}_source`,
          type: `${terms.reserve}_kind`,
          amount: `${terms.reserve}_value`,
          currency: `${terms.reserve}_unit`,
          description: `${terms.reserve}_note`,
          createdAt: `${terms.reserve}_posted_at`
        }),
        account: mapFields(field, {
          accountId: `${terms.auth}_seat_ref`,
          balance: `${terms.reserve}_available`,
          currency: `${terms.reserve}_unit`
        }),
        user: mapFields(field, {
          userId: `${terms.auth}_operator_ref`,
          email: `${terms.auth}_operator_mail`,
          displayName: `${terms.auth}_operator_label`
        }),
        metrics: mapFields(field, {
          count: `${terms.payment}_count`,
          volume: `${terms.payment}_volume`,
          customers: `${terms.audience}_count`,
          review: `${terms.product}_attention`,
          currency: `${terms.reserve}_unit`
        })
      },
      auth: {
        tokenResponseKey: field(`${terms.auth}_token`),
        tokenStorageKey: `session:${field(`${terms.auth}_${terms.product}`)}`,
        errorKey: field(`${terms.auth}_error`),
        fields: mapFields(field, {
          email: `${terms.auth}_mail`,
          password: `${terms.auth}_secret`,
          displayName: `${terms.auth}_operator`,
          currency: `${terms.reserve}_unit`
        }) as LayoutBuilderAiBrandSpec["auth"]["fields"]
      },
      statuses: statusMap(intent, field, terms),
      ui: {
        labels: {
          register: label(intent, "register", intent.copy.registerTitle),
          login: label(intent, "login", intent.copy.loginTitle),
          createPayment: label(intent, "createPayment", `Create ${human(terms.payment)}`),
          history: label(intent, "history", `${title(human(terms.payment))} history`),
          refund: label(intent, "refund", `Reverse ${human(terms.payment)}`),
          overview: label(intent, "overview", `${title(human(terms.product))} overview`),
          payments: label(intent, "payments", title(human(resourceAlias))),
          customers: label(intent, "customers", `${title(human(terms.audience))} records`),
          balances: label(intent, "balances", `${title(human(terms.reserve))} view`)
        },
        navigation: {
          dashboard: navLabel(intent, "dashboard", title(human(terms.product))),
          payments: navLabel(intent, "payments", title(human(terms.payment))),
          customers: navLabel(intent, "customers", title(human(terms.audience))),
          balances: navLabel(intent, "balances", title(human(terms.reserve)))
        },
        tableLabels: {
          id: title(human(terms.payment)),
          status: "State",
          amount: "Value",
          customer: title(human(terms.audience)),
          createdAt: "Opened"
        },
        formLabels: {
          amount: `${title(human(terms.payment))} value`,
          customer: title(human(terms.audience)),
          method: title(human(terms.rail))
        },
        authExperience: authExperience(intent, presentation, terms),
        paymentsExperience: paymentsExperience(intent, presentation, terms, resourceAlias),
        presentation: {
          layout: presentation.layout,
          density: presentation.density,
          navigationPattern: presentation.navigationPattern,
          dashboardComposition: dashboardBlocks(intent.uiDirection.dashboardBlocks),
          visualTokens: {
            palette: presentation.palette,
            typography: presentation.typography,
            radius: presentation.radius,
            spacing: presentation.spacing,
            surfaces: presentation.surfaces,
            buttons: presentation.buttons
          },
          copyTone: intent.concept.tone,
          componentLabels: {
            metricsCard: `${title(human(terms.product))} signals`,
            paymentTable: `${title(human(terms.payment))} register`,
            createPanel: `Create ${human(terms.payment)}`
          },
          emptyStates: intent.copy.emptyStates
        }
      }
    };
  }
}

function normalizeControls(
  intent: LayoutBuilderBrandGenerationIntent,
  input: Partial<LayoutBuilderAiGenerationControls>
): LayoutBuilderAiGenerationControls {
  return {
    ...DEFAULT_AI_GENERATION_CONTROLS,
    fieldStyle: intent.namingRules.fieldStyle ?? DEFAULT_AI_GENERATION_CONTROLS.fieldStyle,
    ...input
  };
}

function intentTerms(intent: LayoutBuilderBrandGenerationIntent): Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string> {
  const preferred = intent.concept.preferredTerms.map((term) => safeToken(term)).filter(Boolean);
  return {
    product: safeToken(preferred[0] ?? intent.concept.productMetaphor) || "workspace",
    auth: safeToken(preferred[1] ?? intent.concept.authMetaphor) || "access",
    payment: safeToken(preferred[2] ?? intent.concept.paymentMetaphor) || "movement",
    audience: safeToken(preferred[3] ?? intent.concept.audience) || "client",
    rail: safeToken(preferred[4] ?? intent.namingRules.routeStyle) || "rail",
    reserve: safeToken(preferred[5] ?? intent.concept.domain) || "reserve"
  };
}

function routeFactory(terms: Record<string, string>, intent: LayoutBuilderBrandGenerationIntent): { next: (entityName: string, parts: string[]) => string } {
  const used = new Set<string>();
  const reserved = new Set([...RESERVED_PUBLIC_ROUTES, ...intent.namingRules.forbiddenCanonicalNames.map((value) => slug(value)), ...intent.concept.avoidWords.map((value) => slug(value))]);
  const semanticSuffixes = ["desk", "lane", "book", "view", "stream", "grid", "vault", "pulse", "station", "hub"];

  return {
    next(entityName, parts) {
      const candidates = [
        slug(parts.join("-")),
        slug([parts[0], terms.product].join("-")),
        slug([parts[0], semanticSuffixes[used.size % semanticSuffixes.length]].join("-")),
        slug([terms.product, semanticSuffixes[(used.size + 3) % semanticSuffixes.length]].join("-"))
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (!used.has(candidate) && !reserved.has(candidate)) {
          used.add(candidate);
          return candidate;
        }
      }

      const fallback = slug(`${safeToken(entityName)}-${semanticSuffixes[used.size % semanticSuffixes.length]}`);
      used.add(fallback);
      return fallback;
    }
  };
}

function paymentRouteParts(
  intent: LayoutBuilderBrandGenerationIntent,
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>,
  presentation: ReturnType<typeof visualSystem>
): string[] {
  const suffix = routeStyleToken(intent) ?? paymentRouteSuffix(presentation.layout);
  return [intent.concept.paymentMetaphor || terms.payment, suffix];
}

function routeStyleToken(intent: LayoutBuilderBrandGenerationIntent): string | undefined {
  const blocked = new Set([
    "payment",
    "payments",
    "generic",
    "words",
    "without",
    "terms",
    "route",
    "routes",
    "slug",
    "slugs",
    "style",
    "short",
    "public",
    "canonical",
    ...intent.namingRules.forbiddenCanonicalNames.map((value) => safeToken(value)),
    ...intent.concept.avoidWords.map((value) => safeToken(value))
  ]);
  const tokens = intent.namingRules.routeStyle
    .split(/[^a-zA-Zа-яА-Я0-9]+/u)
    .map((value) => safeToken(value))
    .filter((value) => value.length > 2 && value !== "ledger" && !blocked.has(value));

  return tokens[0];
}

function paymentRouteSuffix(layout: ReturnType<typeof visualSystem>["layout"]): string {
  const suffixes: Record<ReturnType<typeof visualSystem>["layout"], string> = {
    "card-operations": "drop",
    "compact-terminal": "stream",
    "split-workspace": "flow",
    "topbar-console": "lane",
    "command-center": "run",
    "sidebar-ledger": "register"
  };

  return suffixes[layout] ?? "flow";
}

function entity(route: string, method: "GET" | "POST", requiresSession: boolean, requestKey: string, responseKey: string, emptyState: string): LayoutBuilderAiBrandSpec["entities"]["payments"] {
  return { route, method, requiresSession, requestKey, responseKey, emptyState };
}

function paymentFields(terms: Record<string, string>): Record<string, string> {
  return {
    paymentId: `${terms.payment}_ref`,
    externalReference: `${terms.product}_marker`,
    paymentIntentId: `${terms.payment}_intent`,
    customerId: `${terms.audience}_ref`,
    paymentMethodId: `${terms.rail}_ref`,
    status: `${terms.payment}_state`,
    amount: `${terms.payment}_value`,
    currency: `${terms.reserve}_unit`,
    destinationLabel: `${terms.audience}_destination`,
    methodType: `${terms.rail}_kind`,
    createdAt: `${terms.payment}_opened_at`
  };
}

function statusMap(
  intent: LayoutBuilderBrandGenerationIntent,
  field: (value: string) => string,
  terms: Record<string, string>
): Record<PaymentCoreStatus, string> {
  const fallback: Record<PaymentCoreStatus, string> = {
    created: `${terms.payment}_opened`,
    requires_payment_method: `${terms.rail}_needed`,
    requires_confirmation: `${terms.auth}_review`,
    processing: `${terms.payment}_moving`,
    authorized: `${terms.reserve}_held`,
    captured: `${terms.payment}_captured`,
    settled: `${terms.payment}_posted`,
    failed: `${terms.payment}_blocked`,
    canceled: `${terms.payment}_voided`,
    refunded: `${terms.reserve}_returned`
  };

  return Object.fromEntries(
    PAYMENT_STATUSES.map((status) => [status, field(safeToken(intent.statusVocabulary?.[status] ?? fallback[status]) || fallback[status])])
  ) as Record<PaymentCoreStatus, string>;
}

function mapFields(field: (value: string) => string, values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, field(value)]));
}

function fieldFormatter(style: LayoutBuilderFieldStyle): (value: string) => string {
  return (value) => {
    const token = safeToken(value) || "field";
    if (style === "camelCase") {
      return token
        .split("_")
        .map((part, index) => (index === 0 ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
        .join("");
    }
    if (style === "kebab-case") {
      return token.replaceAll("_", "-");
    }
    return token;
  };
}

function safeToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .replace(/_+/gu, "_");
}

function slug(value: string): string {
  return safeToken(value).replaceAll("_", "-").slice(0, 80);
}

function human(value: string): string {
  return value.replaceAll(/[-_]+/gu, " ");
}

function title(value: string): string {
  return value.replace(/\b[a-z]/gu, (match) => match.toUpperCase());
}

function label(intent: LayoutBuilderBrandGenerationIntent, key: string, fallback: string): string {
  return intent.copy.actionLabels[key] ?? fallback;
}

function navLabel(intent: LayoutBuilderBrandGenerationIntent, key: string, fallback: string): string {
  return intent.copy.actionLabels[`nav_${key}`] ?? intent.copy.actionLabels[key] ?? fallback;
}

function empty(intent: LayoutBuilderBrandGenerationIntent, key: string): string {
  return intent.copy.emptyStates[key] ?? `No ${key} loaded yet.`;
}

function pickAllowed<T extends string>(value: string, allowed: readonly T[], fallback: T): T {
  const normalized = value.toLowerCase().replaceAll(/\s+/gu, "-");
  return allowed.find((entry) => entry === normalized) ?? fallback;
}

function pickLayout(value: string): LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"] {
  const normalized = normalizedPhrase(value);
  const compactWords = ["terminal", "console log", "cli", "shell", "compact terminal"];
  const cardWords = ["card", "tile", "wall", "board", "kanban"];
  const splitWords = ["split", "two column", "workspace", "dual", "side by side"];
  const topbarWords = ["topbar", "top bar", "top nav", "header", "tabs"];
  const commandWords = ["command", "control", "mission", "ops center", "center"];
  const sidebarWords = ["sidebar", "ledger", "classic"];

  if (hasAny(normalized, compactWords)) {
    return "compact-terminal";
  }
  if (hasAny(normalized, cardWords)) {
    return "card-operations";
  }
  if (hasAny(normalized, splitWords)) {
    return "split-workspace";
  }
  if (hasAny(normalized, topbarWords)) {
    return "topbar-console";
  }
  if (hasAny(normalized, commandWords)) {
    return "command-center";
  }
  if (hasAny(normalized, sidebarWords)) {
    return "sidebar-ledger";
  }

  return pickAllowed(value, AI_UI_LAYOUTS, "sidebar-ledger");
}

function pickDensity(value: string): LayoutBuilderAiBrandSpec["ui"]["presentation"]["density"] {
  const normalized = normalizedPhrase(value);

  if (hasAny(normalized, ["compact", "dense", "tight", "terminal"])) {
    return "compact";
  }
  if (hasAny(normalized, ["spacious", "open", "airy", "large"])) {
    return "spacious";
  }

  return pickAllowed(value, AI_UI_DENSITIES, "balanced");
}

function pickNavigation(value: string): LayoutBuilderAiBrandSpec["ui"]["presentation"]["navigationPattern"] {
  const normalized = normalizedPhrase(value);

  if (hasAny(normalized, ["command", "rail", "palette", "launcher"])) {
    return "command-rail";
  }
  if (hasAny(normalized, ["top", "tab", "header"])) {
    return "top-tabs";
  }

  return pickAllowed(value, AI_UI_NAVIGATION_PATTERNS, "sidebar");
}

function normalizedPhrase(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, " ").trim();
}

function hasAny(value: string, needles: readonly string[]): boolean {
  return needles.some((needle) => value.includes(needle));
}

function dashboardBlocks(values: string[]): LayoutBuilderAiDashboardBlock[] {
  const normalized = values.map((value) => value.replaceAll(/\s+/gu, "").replace(/^recentpayments$/iu, "recentPayments"));
  const selected = normalized.filter((value): value is LayoutBuilderAiDashboardBlock =>
    (AI_DASHBOARD_BLOCKS as readonly string[]).includes(value)
  );
  const merged = [...new Set([...selected, "metrics", "recentPayments", "createPayment"])] as LayoutBuilderAiDashboardBlock[];

  return merged.slice(0, AI_DASHBOARD_BLOCKS.length);
}

function visualSystem(
  intent: LayoutBuilderBrandGenerationIntent,
  controls: LayoutBuilderAiGenerationControls
): {
  buttons: string;
  density: LayoutBuilderAiBrandSpec["ui"]["presentation"]["density"];
  layout: LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"];
  navigationPattern: LayoutBuilderAiBrandSpec["ui"]["presentation"]["navigationPattern"];
  palette: string[];
  radius: string;
  spacing: string;
  surfaces: string;
  typography: string;
  visualDirection: string;
} {
  const layout = pickLayout(intent.uiDirection.layout);
  const density = pickDensity(intent.uiDirection.density);
  const navigationPattern = pickNavigation(intent.uiDirection.navigation);
  const palette = professionalPalette(intent, layout);
  const isDarkLayout = layout === "command-center" || layout === "compact-terminal";
  const densityText = density === "compact" ? "dense but legible" : density === "spacious" ? "open and scannable" : "balanced";
  const visualStyle = intent.uiDirection.visualStyle.trim();
  const navigation = intent.uiDirection.navigation.trim();

  return {
    buttons: limitText(isDarkLayout
      ? `${visualStyle}; high-contrast primary actions with restrained secondary controls`
      : `${visualStyle}; solid primary actions with quiet secondary controls`, 176),
    density,
    layout,
    navigationPattern,
    palette,
    radius: controls.namingIntensity === "maximum" || density === "compact" ? "6px" : "8px",
    spacing: limitText(`${densityText} spacing shaped by ${navigation || "the generated navigation model"}`, 176),
    surfaces: limitText(isDarkLayout
      ? `${visualStyle}; dark shell with readable raised panels and strong numeric contrast`
      : `${visualStyle}; readable work surfaces with low-noise borders and clear hierarchy`, 176),
    typography: typographyForLayout(layout, intent.concept.tone),
    visualDirection: `${intent.uiDirection.visualStyle}. Normalize into a production payment dashboard with readable contrast, restrained accents, clear hierarchy, and accessible controls.`
  };
}

function limitText(value: string, max: number): string {
  const clean = value.replaceAll(/\s+/gu, " ").trim();

  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd();
}

function authExperience(
  intent: LayoutBuilderBrandGenerationIntent,
  presentation: ReturnType<typeof visualSystem>,
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>
): LayoutBuilderAiBrandSpec["ui"]["authExperience"] {
  const input = intent.authExperience;
  const authDefaults = authDefaultsFor(presentation, intent.brandName);
  const authLabel = title(human(terms.auth));
  const audienceLabel = title(human(terms.audience));
  const passwordLabel = authSecretLabel(intent, authLabel);

  return {
    content: {
      headline: input?.content?.headline ?? intent.brandName,
      description:
        input?.content?.description ??
        `${intent.brandName} access for ${intent.concept.audience}, shaped around ${intent.concept.authMetaphor} and ${intent.concept.paymentMetaphor}.`
    },
    composition: {
      frame: pickAllowed(input?.composition?.frame ?? "", ["split", "centered", "offset", "console", "minimal"] as const, authDefaults.frame),
      brandTreatment: pickAllowed(input?.composition?.brandTreatment ?? "", ["stacked", "inline", "badge"] as const, authDefaults.brandTreatment),
      showDescription: input?.composition?.showDescription ?? authDefaults.showDescription
    },
    layout: {
      brandColumn: clampNumber(input?.layout?.brandColumn, 30, 70, authDefaults.brandColumn),
      formMaxWidth: clampNumber(input?.layout?.formMaxWidth, 320, 620, authDefaults.formMaxWidth),
      logoSize: clampNumber(input?.layout?.logoSize, 48, 128, authDefaults.logoSize),
      panelPadding: clampNumber(input?.layout?.panelPadding, 12, 40, authDefaults.panelPadding),
      gap: clampNumber(input?.layout?.gap, 16, 72, authDefaults.gap),
      brandAlignment: pickAllowed(input?.layout?.brandAlignment ?? "", ["start", "center", "end"] as const, authDefaults.brandAlignment),
      formAlignment: pickAllowed(input?.layout?.formAlignment ?? "", ["start", "center", "end"] as const, authDefaults.formAlignment),
      textAlign: pickAllowed(input?.layout?.textAlign ?? "", ["left", "center", "right"] as const, authDefaults.textAlign),
      mobileOrder: pickAllowed(input?.layout?.mobileOrder ?? "", ["brand-first", "form-first"] as const, authDefaults.mobileOrder)
    },
    form: {
      modeControl: pickAllowed(input?.form?.modeControl ?? "", ["segmented", "tabs", "toggle"] as const, authDefaults.modeControl),
      fieldTreatment: pickAllowed(input?.form?.fieldTreatment ?? "", ["boxed", "filled", "underlined"] as const, authDefaults.fieldTreatment),
      surface: pickAllowed(input?.form?.surface ?? "", ["flat", "raised", "outlined"] as const, authDefaults.surface),
      showDisplayNameOnLogin: input?.form?.showDisplayNameOnLogin ?? false,
      fields: {
        email: {
          label: input?.form?.fields?.email?.label ?? `${audienceLabel} email`,
          placeholder: input?.form?.fields?.email?.placeholder ?? "client@example.com"
        },
        password: {
          label: input?.form?.fields?.password?.label ?? passwordLabel,
          placeholder: input?.form?.fields?.password?.placeholder ?? "local-demo-password"
        },
        displayName: {
          label: input?.form?.fields?.displayName?.label ?? `${audienceLabel} name`,
          placeholder: input?.form?.fields?.displayName?.placeholder ?? `${intent.brandName} operator`
        }
      }
    },
    visual: {
      background: input?.visual?.background ?? presentation.surfaces,
      panel: input?.visual?.panel ?? presentation.buttons,
      accent: input?.visual?.accent ?? intent.concept.tone
    }
  };
}

function authSecretLabel(intent: LayoutBuilderBrandGenerationIntent, authLabel: string): string {
  if (/\b(key|pass|seal|code|token|phrase|pin)\b/iu.test(authLabel)) {
    return title(human(intent.concept.authMetaphor)) || authLabel;
  }

  return `${authLabel} key`;
}

function authDefaultsFor(
  presentation: ReturnType<typeof visualSystem>,
  brandName: string
): {
  brandColumn: number;
  formMaxWidth: number;
  logoSize: number;
  panelPadding: number;
  gap: number;
  brandAlignment: "start" | "center" | "end";
  formAlignment: "start" | "center" | "end";
  textAlign: "left" | "center" | "right";
  mobileOrder: "brand-first" | "form-first";
  modeControl: "segmented" | "tabs" | "toggle";
  fieldTreatment: "boxed" | "filled" | "underlined";
  surface: "flat" | "raised" | "outlined";
  frame: "split" | "centered" | "offset" | "console" | "minimal";
  brandTreatment: "stacked" | "inline" | "badge";
  showDescription: boolean;
} {
  const isCompact = presentation.density === "compact";

  if (presentation.layout === "card-operations") {
    return {
      brandColumn: 38,
      formMaxWidth: 520,
      logoSize: 96,
      panelPadding: 24,
      gap: 42,
      brandAlignment: "start",
      formAlignment: "end",
      textAlign: "left",
      mobileOrder: "form-first",
      modeControl: "toggle",
      fieldTreatment: "boxed",
      surface: "raised",
      frame: "offset",
      brandTreatment: "stacked",
      showDescription: true
    };
  }

  if (presentation.layout === "split-workspace") {
    return {
      brandColumn: 44,
      formMaxWidth: 460,
      logoSize: 72,
      panelPadding: 18,
      gap: 28,
      brandAlignment: "start",
      formAlignment: "center",
      textAlign: "left",
      mobileOrder: "brand-first",
      modeControl: "tabs",
      fieldTreatment: "boxed",
      surface: "outlined",
      frame: "split",
      brandTreatment: "stacked",
      showDescription: true
    };
  }

  if (presentation.layout === "topbar-console") {
    return {
      brandColumn: 58,
      formMaxWidth: 400,
      logoSize: 68,
      panelPadding: 20,
      gap: 30,
      brandAlignment: "start",
      formAlignment: "center",
      textAlign: "left",
      mobileOrder: "brand-first",
      modeControl: "tabs",
      fieldTreatment: "filled",
      surface: "raised",
      frame: "offset",
      brandTreatment: "inline",
      showDescription: true
    };
  }

  if (presentation.layout === "compact-terminal") {
    return {
      brandColumn: 52,
      formMaxWidth: 390,
      logoSize: 58,
      panelPadding: 14,
      gap: 20,
      brandAlignment: "start",
      formAlignment: "end",
      textAlign: "left",
      mobileOrder: "form-first",
      modeControl: "segmented",
      fieldTreatment: "underlined",
      surface: "flat",
      frame: "console",
      brandTreatment: "badge",
      showDescription: false
    };
  }

  return {
    brandColumn: brandName.length > 18 ? 46 : 50,
    formMaxWidth: isCompact ? 380 : 440,
    logoSize: isCompact ? 64 : 84,
    panelPadding: isCompact ? 16 : 22,
    gap: isCompact ? 22 : 32,
    brandAlignment: presentation.layout === "command-center" ? "center" : "start",
    formAlignment: "center",
    textAlign: presentation.layout === "command-center" ? "center" : "left",
    mobileOrder: "brand-first",
    modeControl: presentation.navigationPattern === "top-tabs" ? "tabs" : "segmented",
    fieldTreatment: isCompact ? "underlined" : presentation.layout === "command-center" ? "filled" : "boxed",
    surface: presentation.layout === "command-center" ? "outlined" : "raised",
    frame: presentation.layout === "command-center" ? "centered" : "split",
    brandTreatment: presentation.layout === "command-center" ? "badge" : "stacked",
    showDescription: presentation.layout !== "command-center"
  };
}

function paymentsExperience(
  intent: LayoutBuilderBrandGenerationIntent,
  presentation: ReturnType<typeof visualSystem>,
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>,
  resourceAlias: string
): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"] {
  const input = intent.paymentsExperience;
  const paymentDefaults = paymentDefaultsFor(presentation);

  return {
    content: {
      headline: input?.content?.headline ?? label(intent, "payments", title(human(resourceAlias))),
      description: input?.content?.description ?? `${title(human(terms.payment))} activity table for ${intent.concept.audience}.`,
      emptyState: input?.content?.emptyState ?? empty(intent, "payments")
    },
    composition: {
      metricsPlacement: pickAllowed(input?.composition?.metricsPlacement ?? "", ["top", "left", "right", "hidden"] as const, paymentDefaults.metricsPlacement),
      activityPattern: "table",
      statusTreatment: pickAllowed(input?.composition?.statusTreatment ?? "", ["badge", "rail", "dot"] as const, paymentDefaults.statusTreatment),
      amountEmphasis: pickAllowed(input?.composition?.amountEmphasis ?? "", ["primary", "secondary", "balanced"] as const, paymentDefaults.amountEmphasis),
      showCustomer: input?.composition?.showCustomer ?? true,
      showMethod: input?.composition?.showMethod ?? paymentDefaults.showMethod,
      showTimestamp: input?.composition?.showTimestamp ?? true,
      maxItems: clampNumber(input?.composition?.maxItems, 4, 30, paymentDefaults.maxItems)
    },
    layout: {
      metricsColumns: clampNumber(input?.layout?.metricsColumns, 1, 5, paymentDefaults.metricsColumns),
      sidebarWidth: clampNumber(input?.layout?.sidebarWidth, 180, 420, paymentDefaults.sidebarWidth),
      cardMinWidth: clampNumber(input?.layout?.cardMinWidth, 180, 420, paymentDefaults.cardMinWidth),
      gap: clampNumber(input?.layout?.gap, 8, 48, paymentDefaults.gap),
      panelPadding: clampNumber(input?.layout?.panelPadding, 10, 36, paymentDefaults.panelPadding),
      rowMinHeight: clampNumber(input?.layout?.rowMinHeight, 44, 112, paymentDefaults.rowMinHeight)
    },
    table: paymentTableFor(input?.table, paymentDefaults.table, terms, resourceAlias),
    visual: {
      surface: limitText(input?.visual?.surface ?? presentation.surfaces, 176),
      status: limitText(input?.visual?.status ?? presentation.buttons, 156),
      dataDensity: limitText(input?.visual?.dataDensity ?? presentation.spacing, 176)
    },
    createPayment: {
      enabled: input?.createPayment?.enabled ?? true,
      placement: pickAllowed(
        input?.createPayment?.placement ?? "",
        ["intro", "activity-top", "activity-bottom", "sidecar"] as const,
        paymentDefaults.createPlacement
      ),
      surface: pickAllowed(input?.createPayment?.surface ?? "", ["compact", "panel", "inline"] as const, paymentDefaults.createSurface),
      tone: pickAllowed(input?.createPayment?.tone ?? "", ["minimal", "operator", "guided"] as const, paymentDefaults.createTone),
      defaultScenario: pickAllowed(input?.createPayment?.defaultScenario ?? "", ["settle", "review", "reserve", "fail"] as const, "settle"),
      labels: {
        title: input?.createPayment?.labels?.title ?? label(intent, "createPayment", `Create ${human(terms.payment)}`),
        amount: input?.createPayment?.labels?.amount ?? "Amount",
        currency: input?.createPayment?.labels?.currency ?? "Currency",
        customer: input?.createPayment?.labels?.customer ?? title(human(terms.audience)),
        customerEmail: input?.createPayment?.labels?.customerEmail ?? `${title(human(terms.audience))} email`,
        methodType: input?.createPayment?.labels?.methodType ?? title(human(terms.rail)),
        instrument: input?.createPayment?.labels?.instrument ?? `${title(human(terms.rail))} reference`,
        scenario: input?.createPayment?.labels?.scenario ?? "Processing route",
        submit: input?.createPayment?.labels?.submit ?? label(intent, "createPayment", `Create ${human(terms.payment)}`)
      }
    }
  };
}

function paymentDefaultsFor(presentation: ReturnType<typeof visualSystem>): {
  metricsPlacement: "top" | "left" | "right" | "hidden";
  activityPattern: "table";
  statusTreatment: "badge" | "rail" | "dot";
  amountEmphasis: "primary" | "secondary" | "balanced";
  showMethod: boolean;
  maxItems: number;
  metricsColumns: number;
  sidebarWidth: number;
  cardMinWidth: number;
  gap: number;
  panelPadding: number;
  rowMinHeight: number;
  createPlacement: "intro" | "activity-top" | "activity-bottom" | "sidecar";
  createSurface: "compact" | "panel" | "inline";
  createTone: "minimal" | "operator" | "guided";
  table: LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"];
} {
  if (presentation.layout === "card-operations") {
    return {
      metricsPlacement: "right",
      activityPattern: "table",
      statusTreatment: "rail",
      amountEmphasis: "primary",
      showMethod: true,
      maxItems: 8,
      metricsColumns: 1,
      sidebarWidth: 300,
      cardMinWidth: 280,
      gap: 20,
      panelPadding: 18,
      rowMinHeight: 78,
      createPlacement: "sidecar",
      createSurface: "panel",
      createTone: "guided",
      table: tableDefaults("card-operations")
    };
  }

  if (presentation.layout === "compact-terminal") {
    return {
      metricsPlacement: "hidden",
      activityPattern: "table",
      statusTreatment: "dot",
      amountEmphasis: "secondary",
      showMethod: false,
      maxItems: 14,
      metricsColumns: 2,
      sidebarWidth: 220,
      cardMinWidth: 220,
      gap: 10,
      panelPadding: 12,
      rowMinHeight: 52,
      createPlacement: "activity-bottom",
      createSurface: "compact",
      createTone: "minimal",
      table: tableDefaults("compact-terminal")
    };
  }

  if (presentation.layout === "split-workspace") {
    return {
      metricsPlacement: "left",
      activityPattern: "table",
      statusTreatment: "badge",
      amountEmphasis: "balanced",
      showMethod: true,
      maxItems: 10,
      metricsColumns: 1,
      sidebarWidth: 260,
      cardMinWidth: 240,
      gap: 18,
      panelPadding: 16,
      rowMinHeight: 66,
      createPlacement: "activity-top",
      createSurface: "inline",
      createTone: "operator",
      table: tableDefaults("split-workspace")
    };
  }

  if (presentation.layout === "topbar-console") {
    return {
      metricsPlacement: "top",
      activityPattern: "table",
      statusTreatment: "badge",
      amountEmphasis: "primary",
      showMethod: true,
      maxItems: 9,
      metricsColumns: 4,
      sidebarWidth: 280,
      cardMinWidth: 250,
      gap: 18,
      panelPadding: 16,
      rowMinHeight: 72,
      createPlacement: "intro",
      createSurface: "inline",
      createTone: "operator",
      table: tableDefaults("topbar-console")
    };
  }

  if (presentation.layout === "command-center") {
    return {
      metricsPlacement: "top",
      activityPattern: "table",
      statusTreatment: "dot",
      amountEmphasis: "balanced",
      showMethod: true,
      maxItems: 12,
      metricsColumns: 3,
      sidebarWidth: 280,
      cardMinWidth: 240,
      gap: 14,
      panelPadding: 14,
      rowMinHeight: 58,
      createPlacement: "activity-top",
      createSurface: "compact",
      createTone: "operator",
      table: tableDefaults("command-center")
    };
  }

  return {
    metricsPlacement: "top",
    activityPattern: "table",
    statusTreatment: "badge",
    amountEmphasis: "balanced",
    showMethod: true,
    maxItems: 10,
    metricsColumns: 3,
    sidebarWidth: 280,
    cardMinWidth: 240,
    gap: 16,
    panelPadding: 16,
    rowMinHeight: 64,
    createPlacement: "activity-top",
    createSurface: "panel",
    createTone: "operator",
    table: tableDefaults("sidebar-ledger")
  };
}

function paymentTableFor(
  input: LayoutBuilderDeepPartial<LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]> | undefined,
  fallback: LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"],
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>,
  resourceAlias: string
): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"] {
  return {
    titlePlacement: pickAllowed(input?.titlePlacement ?? "", ["page", "table", "hidden"] as const, fallback.titlePlacement),
    controlsPlacement: pickAllowed(input?.controlsPlacement ?? "", ["above", "side", "none"] as const, fallback.controlsPlacement),
    density: pickAllowed(input?.density ?? "", ["compact", "regular", "spacious"] as const, fallback.density),
    columns: normalizeTableColumns(input?.columns, fallback.columns, terms, resourceAlias)
  };
}

function normalizeTableColumns(
  input: readonly LayoutBuilderDeepPartial<LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"][number]>[] | undefined,
  fallback: LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"],
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>,
  resourceAlias: string
): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"] {
  const allowed = new Set(["reference", "status", "amount", "customer", "method", "createdAt", "destination"]);
  const cleaned = (input ?? [])
    .filter((column): column is LayoutBuilderDeepPartial<LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"][number]> & { key: LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"][number]["key"]; label: string } =>
      typeof column.key === "string" && allowed.has(column.key) && typeof column.label === "string" && column.label.trim().length > 0
    )
    .map((column, index) => ({
      key: column.key,
      label: column.label.trim().slice(0, 50),
      priority: clampNumber(column.priority, 1, 7, index + 1)
    }));
  const source = cleaned.length >= 4 ? cleaned : fallback;
  const deduped: LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"] = [];

  for (const column of source) {
    if (!deduped.some((existing) => existing.key === column.key)) {
      deduped.push(column);
    }
  }

  for (const required of requiredTableColumns(terms, resourceAlias)) {
    if (!deduped.some((column) => column.key === required.key)) {
      deduped.unshift(required);
    }
  }

  return deduped
    .slice(0, 7)
    .map((column, index) => ({ ...column, priority: index + 1 }));
}

function requiredTableColumns(
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>,
  resourceAlias: string
): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"] {
  return [
    { key: "reference", label: title(human(resourceAlias)), priority: 1 },
    { key: "status", label: `${title(human(terms.payment))} state`, priority: 2 },
    { key: "amount", label: title(human(terms.reserve)), priority: 3 }
  ];
}

function tableDefaults(layout: ReturnType<typeof visualSystem>["layout"]): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"] {
  const common = {
    "sidebar-ledger": {
      titlePlacement: "table",
      controlsPlacement: "above",
      density: "regular",
      columns: [
        ["reference", "Movement"],
        ["status", "State"],
        ["amount", "Value"],
        ["customer", "Counterparty"],
        ["method", "Rail"],
        ["createdAt", "Opened"]
      ]
    },
    "topbar-console": {
      titlePlacement: "hidden",
      controlsPlacement: "above",
      density: "regular",
      columns: [
        ["status", "Lane"],
        ["reference", "Trade"],
        ["customer", "Player"],
        ["destination", "Destination"],
        ["amount", "Value"],
        ["method", "Source"],
        ["createdAt", "Queued"]
      ]
    },
    "split-workspace": {
      titlePlacement: "table",
      controlsPlacement: "side",
      density: "spacious",
      columns: [
        ["reference", "Case"],
        ["customer", "Party"],
        ["method", "Instrument"],
        ["status", "Review"],
        ["amount", "Gross"],
        ["createdAt", "Booked"]
      ]
    },
    "command-center": {
      titlePlacement: "page",
      controlsPlacement: "none",
      density: "compact",
      columns: [
        ["status", "Signal"],
        ["createdAt", "Time"],
        ["reference", "Command"],
        ["amount", "Reserve"],
        ["customer", "Identity"]
      ]
    },
    "card-operations": {
      titlePlacement: "table",
      controlsPlacement: "side",
      density: "spacious",
      columns: [
        ["reference", "Drop"],
        ["customer", "Player"],
        ["amount", "Reward"],
        ["status", "Rail"],
        ["destination", "Target"]
      ]
    },
    "compact-terminal": {
      titlePlacement: "hidden",
      controlsPlacement: "none",
      density: "compact",
      columns: [
        ["createdAt", "Time"],
        ["reference", "Packet"],
        ["status", "Exit"],
        ["amount", "Cache"],
        ["method", "Socket"]
      ]
    }
  }[layout];

  return {
    titlePlacement: common.titlePlacement as LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["titlePlacement"],
    controlsPlacement: common.controlsPlacement as LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["controlsPlacement"],
    density: common.density as LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["density"],
    columns: common.columns.map(([key, label], index) => ({
      key: key as LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"]["table"]["columns"][number]["key"],
      label: String(label ?? key),
      priority: index + 1
    }))
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function professionalPalette(intent: LayoutBuilderBrandGenerationIntent, layout: LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"]): string[] {
  const requested = intent.uiDirection.palette
    .flatMap((value) => professionalColorTokens(value))
    .filter((value, index, values) => values.indexOf(value) === index);
  const isDarkLayout = layout === "command-center" || layout === "compact-terminal";
  const fallback = isDarkLayout
    ? ["graphite", "slate", "quartz green", "cool white", "signal amber"]
    : ["white", "slate", "blue", "cool white", "amber"];
  const palette = [...requested, ...fallback].filter((value, index, values) => values.indexOf(value) === index);
  const hasLight = palette.some((value) => ["white", "cool white", "cream"].includes(value));
  const hasDark = palette.some((value) => ["graphite", "charcoal", "ink", "midnight", "navy", "slate", "steel"].includes(value));
  const hasAccent = palette.some((value) => !["white", "cool white", "cream", "graphite", "charcoal", "ink", "midnight", "navy", "slate", "steel"].includes(value));

  return [
    ...palette,
    ...(hasLight ? [] : ["cool white"]),
    ...(hasDark ? [] : ["slate"]),
    ...(hasAccent ? [] : ["blue"])
  ].slice(0, 6);
}

function professionalColorTokens(value: string): string[] {
  const raw = value.trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/u.test(raw)) {
    return [raw];
  }

  if (/^#[0-9a-f]{3}$/u.test(raw)) {
    return [`#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`];
  }

  const normalized = raw;
  const tokens: string[] = [];

  for (const [needle, token] of Object.entries(PROFESSIONAL_COLOR_TOKENS)) {
    if (normalized.includes(needle)) {
      tokens.push(token);
    }
  }

  return tokens.length > 0 ? tokens : [safeToken(value).replaceAll("_", " ")].filter(Boolean);
}

function typographyForLayout(layout: LayoutBuilderAiBrandSpec["ui"]["presentation"]["layout"], tone: string): string {
  if (layout === "compact-terminal") {
    return "terminal mono used sparingly for identifiers with readable sans body text";
  }
  if (layout === "command-center") {
    return "compact operations sans with tabular figures and strong section labels";
  }
  if (layout === "card-operations") {
    return "humanist operations sans with readable card titles and calm numeric emphasis";
  }
  if (layout === "topbar-console") {
    return "modern finance sans with tabular figures and clear top navigation";
  }
  if (tone.toLowerCase().includes("premium") || tone.toLowerCase().includes("treasury")) {
    return "premium finance sans with measured headings and tabular figures";
  }

  return "clean product sans with tabular figures and accessible form labels";
}

const PROFESSIONAL_COLOR_TOKENS: Record<string, string> = {
  amber: "amber",
  black: "charcoal",
  blue: "blue",
  charcoal: "charcoal",
  copper: "copper",
  cream: "cream",
  cyan: "cyan",
  graphite: "graphite",
  grey: "slate",
  gray: "slate",
  ink: "ink",
  lime: "lime",
  magenta: "magenta",
  midnight: "midnight",
  navy: "navy",
  orange: "orange",
  acid: "acid lime",
  quartz: "quartz green",
  green: "quartz green",
  slate: "slate",
  steel: "steel",
  teal: "teal",
  tide: "tide blue",
  violet: "violet",
  white: "cool white"
};
