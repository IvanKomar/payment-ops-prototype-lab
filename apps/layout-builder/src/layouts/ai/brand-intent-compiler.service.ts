import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiBrandSpec,
  LayoutBuilderAiDashboardBlock,
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
        payments: entity(routes.next("payments", [intent.concept.paymentMetaphor, "ledger"]), "GET", true, field(`${terms.payment}_filter`), resourceAlias, empty(intent, "payments")),
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
        authExperience: authExperience(intent, presentation),
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
  const layout = pickAllowed(intent.uiDirection.layout, AI_UI_LAYOUTS, "command-center");
  const density = pickAllowed(intent.uiDirection.density, AI_UI_DENSITIES, "balanced");
  const navigationPattern = pickAllowed(intent.uiDirection.navigation, AI_UI_NAVIGATION_PATTERNS, "sidebar");
  const palette = professionalPalette(intent, layout);
  const isDarkLayout = layout === "command-center" || layout === "compact-terminal";
  const densityText = density === "compact" ? "dense but legible" : density === "spacious" ? "open and scannable" : "balanced";

  return {
    buttons: isDarkLayout
      ? "high-contrast primary actions, restrained secondary controls, clear focus and review states"
      : "solid primary actions, quiet secondary controls, visible focus states, and non-destructive review actions",
    density,
    layout,
    navigationPattern,
    palette,
    radius: controls.namingIntensity === "maximum" || density === "compact" ? "6px" : "8px",
    spacing: `${densityText} spacing, stable table rows, predictable forms`,
    surfaces: isDarkLayout
      ? "dark application shell with readable raised panels, subtle borders, and strong numeric contrast"
      : "light application shell with white work surfaces, low-noise borders, and calm financial hierarchy",
    typography: typographyForLayout(layout, intent.concept.tone),
    visualDirection: `${intent.uiDirection.visualStyle}. Normalize into a production payment dashboard with readable contrast, restrained accents, clear hierarchy, and accessible controls.`
  };
}

function authExperience(
  intent: LayoutBuilderBrandGenerationIntent,
  presentation: ReturnType<typeof visualSystem>
): LayoutBuilderAiBrandSpec["ui"]["authExperience"] {
  const input = intent.authExperience;
  const isCompact = presentation.density === "compact";
  const isDark = presentation.layout === "command-center" || presentation.layout === "compact-terminal";

  return {
    content: {
      headline: input?.content?.headline ?? intent.brandName,
      description:
        input?.content?.description ??
        `${intent.brandName} access for ${intent.concept.audience}, shaped around ${intent.concept.authMetaphor} and ${intent.concept.paymentMetaphor}.`
    },
    layout: {
      brandColumn: clampNumber(input?.layout?.brandColumn, 30, 70, presentation.layout === "split-workspace" ? 44 : 50),
      formMaxWidth: clampNumber(input?.layout?.formMaxWidth, 320, 620, isCompact ? 380 : 440),
      logoSize: clampNumber(input?.layout?.logoSize, 48, 128, isCompact ? 64 : 84),
      panelPadding: clampNumber(input?.layout?.panelPadding, 12, 40, isCompact ? 16 : 22),
      gap: clampNumber(input?.layout?.gap, 16, 72, isCompact ? 22 : 32),
      brandAlignment: pickAllowed(input?.layout?.brandAlignment ?? "", ["start", "center", "end"] as const, presentation.layout === "command-center" ? "center" : "start"),
      formAlignment: pickAllowed(input?.layout?.formAlignment ?? "", ["start", "center", "end"] as const, "center"),
      textAlign: pickAllowed(input?.layout?.textAlign ?? "", ["left", "center", "right"] as const, presentation.layout === "command-center" ? "center" : "left"),
      mobileOrder: pickAllowed(input?.layout?.mobileOrder ?? "", ["brand-first", "form-first"] as const, "brand-first")
    },
    form: {
      modeControl: pickAllowed(input?.form?.modeControl ?? "", ["segmented", "tabs", "toggle"] as const, presentation.navigationPattern === "top-tabs" ? "tabs" : "segmented"),
      fieldTreatment: pickAllowed(input?.form?.fieldTreatment ?? "", ["boxed", "filled", "underlined"] as const, isCompact ? "underlined" : isDark ? "filled" : "boxed"),
      surface: pickAllowed(input?.form?.surface ?? "", ["flat", "raised", "outlined"] as const, isDark ? "outlined" : "raised"),
      showDisplayNameOnLogin: input?.form?.showDisplayNameOnLogin ?? false,
      fields: {
        email: {
          label: input?.form?.fields?.email?.label ?? "Email",
          placeholder: input?.form?.fields?.email?.placeholder ?? "client@example.com"
        },
        password: {
          label: input?.form?.fields?.password?.label ?? "Password",
          placeholder: input?.form?.fields?.password?.placeholder ?? "local-demo-password"
        },
        displayName: {
          label: input?.form?.fields?.displayName?.label ?? "Display name",
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

function paymentsExperience(
  intent: LayoutBuilderBrandGenerationIntent,
  presentation: ReturnType<typeof visualSystem>,
  terms: Record<"product" | "auth" | "payment" | "audience" | "rail" | "reserve", string>,
  resourceAlias: string
): LayoutBuilderAiBrandSpec["ui"]["paymentsExperience"] {
  const input = intent.paymentsExperience;
  const isCompact = presentation.density === "compact";
  const isCardLike = presentation.layout === "card-operations";

  return {
    content: {
      headline: input?.content?.headline ?? label(intent, "payments", title(human(resourceAlias))),
      description:
        input?.content?.description ??
        `${intent.brandName} shows ${human(terms.payment)} activity for ${intent.concept.audience} with ${intent.concept.paymentMetaphor} language.`,
      emptyState: input?.content?.emptyState ?? empty(intent, "payments")
    },
    composition: {
      metricsPlacement: pickAllowed(input?.composition?.metricsPlacement ?? "", ["top", "left", "right", "hidden"] as const, presentation.layout === "split-workspace" ? "left" : "top"),
      activityPattern: pickAllowed(input?.composition?.activityPattern ?? "", ["table", "cards", "timeline"] as const, isCardLike ? "cards" : "table"),
      statusTreatment: pickAllowed(input?.composition?.statusTreatment ?? "", ["badge", "rail", "dot"] as const, isCardLike ? "rail" : "badge"),
      amountEmphasis: pickAllowed(input?.composition?.amountEmphasis ?? "", ["primary", "secondary", "balanced"] as const, isCompact ? "secondary" : "balanced"),
      showCustomer: input?.composition?.showCustomer ?? true,
      showMethod: input?.composition?.showMethod ?? !isCompact,
      showTimestamp: input?.composition?.showTimestamp ?? true,
      maxItems: clampNumber(input?.composition?.maxItems, 4, 30, isCompact ? 12 : 10)
    },
    layout: {
      metricsColumns: clampNumber(input?.layout?.metricsColumns, 1, 5, presentation.layout === "topbar-console" ? 4 : 3),
      sidebarWidth: clampNumber(input?.layout?.sidebarWidth, 180, 420, isCompact ? 220 : 280),
      cardMinWidth: clampNumber(input?.layout?.cardMinWidth, 180, 420, isCardLike ? 260 : 220),
      gap: clampNumber(input?.layout?.gap, 8, 48, isCompact ? 12 : 18),
      panelPadding: clampNumber(input?.layout?.panelPadding, 10, 36, isCompact ? 12 : 16),
      rowMinHeight: clampNumber(input?.layout?.rowMinHeight, 44, 112, isCompact ? 54 : 68)
    },
    visual: {
      surface: input?.visual?.surface ?? presentation.surfaces,
      status: input?.visual?.status ?? presentation.buttons,
      dataDensity: input?.visual?.dataDensity ?? presentation.spacing
    }
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
  const normalized = value.toLowerCase();
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
  midnight: "midnight",
  navy: "navy",
  orange: "orange",
  quartz: "quartz green",
  green: "quartz green",
  slate: "slate",
  steel: "steel",
  teal: "teal",
  tide: "tide blue",
  violet: "violet",
  white: "cool white"
};
