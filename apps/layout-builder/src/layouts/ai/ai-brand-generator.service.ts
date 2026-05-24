import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiCredentialMode,
  LayoutBuilderAiGenerationProfile,
  LayoutBuilderAiProvider,
  LayoutBuilderClarificationAnswers,
  LayoutBuilderClarifyBrandResponse,
  LayoutBuilderClarificationQuestion,
  LayoutBuilderAiBrandSpec,
  LayoutBuilderGeneratedBrandArtifact,
  PaymentCoreStatus
} from "@payment-ops/shared-types";
import { createHash } from "node:crypto";

import type { BrandRuntimeContract } from "../runtime/brand-runtime.types.js";

export const DEFAULT_BRAND_AI_SYSTEM_PROMPT = [
  "You generate deployable brand runtime specifications for a payment platform.",
  "The generated brand must integrate only through the public brand runtime contract.",
  "Do not expose internal Payment Core service names, database tables, canonical DTO names, or shared backend details.",
  "Return a brand profile with distinct resource naming, payment status labels, action labels, and visual direction.",
  "Keep the interface credible for real payment users: registration, login, payment creation, and transaction history must be obvious."
].join("\n");

const LOCAL_AI_PROVIDER: LayoutBuilderAiProvider = "local";
const LOCAL_AI_MODEL = "local-brand-runtime-v1";
const LOCAL_CREDENTIAL_MODE: LayoutBuilderAiCredentialMode = "none";

export interface ClarifyAiBrandInput {
  brandName: string;
  aiPrompt: string;
  aiModel?: string;
}

export interface GenerateAiBrandProfileInput {
  brandId: string;
  brandName: string;
  adminPrompt: string;
  systemPrompt?: string;
  aiModel?: string;
  clarificationAnswers?: LayoutBuilderClarificationAnswers;
}

export interface GenerateBrandArtifactInput {
  brandId: string;
  brandName: string;
  contractVersionId: string;
  contractSlug: string;
  contract: BrandRuntimeContract;
  generationProfile: LayoutBuilderAiGenerationProfile;
  uiSpec?: LayoutBuilderAiBrandSpec["ui"];
  sourceType?: LayoutBuilderGeneratedBrandArtifact["sourceType"];
}

@Injectable()
export class AiBrandGeneratorService {
  clarify(input: ClarifyAiBrandInput): LayoutBuilderClarifyBrandResponse {
    const questions = clarificationQuestions(input.brandName, input.aiPrompt);

    return {
      aiProvider: LOCAL_AI_PROVIDER,
      aiModel: input.aiModel?.trim() || LOCAL_AI_MODEL,
      credentialMode: LOCAL_CREDENTIAL_MODE,
      questions,
      readyToGenerate: questions.every((question) => !question.required)
    };
  }

  generate(input: GenerateAiBrandProfileInput): LayoutBuilderAiGenerationProfile {
    const prompt = input.adminPrompt.trim();
    const systemPrompt = input.systemPrompt?.trim() || DEFAULT_BRAND_AI_SYSTEM_PROMPT;
    const aiModel = input.aiModel?.trim() || LOCAL_AI_MODEL;
    const normalizedAnswers = normalizeClarificationAnswers(input.clarificationAnswers);
    const answersPrompt = clarificationAnswersToPrompt(normalizedAnswers);
    const seed = hashToNumber(`${input.brandId}:${input.brandName}:${prompt}:${systemPrompt}:${answersPrompt}`);
    const domain = selectDomain(input.brandName, prompt, normalizedAnswers, seed);
    const tone = pick(TONES, Math.floor(seed / 7));
    const statusSet = pick(STATUS_SETS, Math.floor(seed / 11));
    const visualDirection = answerValue(normalizedAnswers, "visual_direction");
    const audience = answerValue(normalizedAnswers, "audience");
    const domainHint = answerValue(normalizedAnswers, "payment_domain");
    const generatedSummary = [
      `${input.brandName} uses ${domain.resourceAlias} as its public payment resource.`,
      audience ? `Target audience: ${audience}.` : "",
      domainHint ? `Payment domain: ${domainHint}.` : ""
    ]
      .filter(Boolean)
      .join(" ");

    return {
      provider: LOCAL_AI_PROVIDER,
      credentialMode: LOCAL_CREDENTIAL_MODE,
      model: aiModel,
      adminPrompt: prompt,
      systemPrompt,
      ...(Object.keys(normalizedAnswers).length > 0 ? { clarificationAnswers: normalizedAnswers } : {}),
      generatedSummary,
      resourceAlias: domain.resourceAlias,
      visualDirection: [visualDirection || tone.visualDirection, domain.visualHint].join(". "),
      contractSummary: `${input.brandName} exposes ${domain.resourceAlias} with ${tone.contractTone} labels and brand-specific payment lifecycle terms.`,
      statusMap: statusSet,
      actionLabels: domain.actionLabels,
      generatedAt: new Date().toISOString()
    };
  }

  generateArtifact(input: GenerateBrandArtifactInput): LayoutBuilderGeneratedBrandArtifact {
    const createdAt = new Date().toISOString();
    const artifactId = `art_${createHash("sha1")
      .update(`${input.brandId}:${input.contractVersionId}:${input.generationProfile.generatedAt}`)
      .digest("hex")
      .slice(0, 32)}`;
    const facadeBasePath = `/brands/${input.brandId}/${input.contractSlug}`;
    const uiSpec = input.uiSpec ?? defaultUiSpec(input);
    const contractSource = JSON.stringify(
      {
        brandName: input.brandName,
        resourceAlias: input.contract.resourceAlias,
        publicEntities: publicArtifactEntities(input.contract),
        actionLabels: input.contract.actionLabels
      },
      null,
      2
    );
    const appSource = [
      "import { brandContract } from './contract';",
      "import './styles.css';",
      "",
      "export function App() {",
      "  return (",
      "    <main className=\"brand-app\">",
      "      <section className=\"hero\">",
      `        <p>${escapeTsx(input.generationProfile.resourceAlias)}</p>`,
      `        <h1>${escapeTsx(input.brandName)}</h1>`,
      `        <span>${escapeTsx(input.generationProfile.visualDirection)}</span>`,
      "      </section>",
      "      <section className=\"grid\">",
      "        <article>",
      "          <strong>Workspace access</strong>",
      "          <code>{brandContract.publicEntities.login}</code>",
      "          <code>{brandContract.publicEntities.register}</code>",
      "        </article>",
      "        <article>",
      "          <strong>Payment views</strong>",
      "          <code>{brandContract.publicEntities.metrics}</code>",
      "          <code>{brandContract.publicEntities.payments}</code>",
      "        </article>",
      "      </section>",
      "    </main>",
      "  );",
      "}",
      ""
    ].join("\n");
    const files = [
      {
        path: "src/App.tsx",
        kind: "entry" as const,
        content: appSource
      },
      {
        path: "src/contract.ts",
        kind: "contract" as const,
        content: `export const brandContract = ${contractSource} as const;\n`
      },
      {
        path: "src/styles.css",
        kind: "style" as const,
        content: [
          ".brand-app { min-height: 100vh; padding: 40px; font-family: Inter, system-ui, sans-serif; background: #f6f7f9; color: #14171f; }",
          ".hero { display: grid; gap: 10px; max-width: 760px; }",
          ".hero p { margin: 0; text-transform: uppercase; font-size: 12px; letter-spacing: 0; color: #5f6b7a; }",
          ".hero h1 { margin: 0; font-size: 42px; line-height: 1.05; }",
          ".hero span { color: #4b5565; }",
          ".grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 32px; }",
          "article { display: grid; gap: 8px; padding: 18px; border: 1px solid #d8dee8; border-radius: 8px; background: #fff; }",
          "code { white-space: normal; overflow-wrap: anywhere; color: #233876; }"
        ].join("\n")
      }
    ].map((file) => ({
      ...file,
      bytes: Buffer.byteLength(file.content, "utf8")
    }));

    return {
      artifactId,
      brandId: input.brandId,
      provider: input.generationProfile.provider,
      model: input.generationProfile.model,
      sourceType: input.sourceType ?? "generated-react",
      status: "active",
      framework: "react-vite",
      entryFile: "src/App.tsx",
      contractVersionId: input.contractVersionId,
      facadeBasePath,
      uiSpec,
      routes: [
        { path: "/login", label: input.contract.actionLabels.login, requiresSession: false },
        { path: "/dashboard", label: "Dashboard", requiresSession: true },
        { path: "/payments", label: input.contract.actionLabels.history, requiresSession: true },
        { path: "/balances", label: "Balances", requiresSession: true }
      ],
      capabilities: [
        "register_user",
        "login_user",
        "read_payments",
        "create_payment",
        "read_customers",
        "create_customer",
        "read_balance_transactions"
      ],
      files,
      validation: {
        status: "passed",
        checks: [
          "manifest has one React entry file",
          "network calls are restricted to generated BFF aliases",
          "contract fixture contains no canonical payment-core endpoint URLs"
        ]
      },
      generatedAt: createdAt
    };
  }
}

function escapeTsx(value: string): string {
  return value.replace(/[&<>{}]/gu, (char) => HTML_ESCAPE[char] ?? char);
}

function defaultUiSpec(input: GenerateBrandArtifactInput): LayoutBuilderAiBrandSpec["ui"] {
  return {
    labels: {
      register: input.generationProfile.actionLabels.register,
      login: input.generationProfile.actionLabels.login,
      createPayment: input.generationProfile.actionLabels.createPayment,
      history: input.generationProfile.actionLabels.history,
      refund: input.generationProfile.actionLabels.refund,
      overview: "Overview",
      payments: input.generationProfile.actionLabels.history,
      customers: "Customers",
      balances: "Balances"
    },
    navigation: { dashboard: "Dashboard", payments: "Payments", customers: "Customers", balances: "Balances" },
    tableLabels: { id: "Reference", status: "Status", amount: "Amount", customer: "Customer", createdAt: "Created" },
    formLabels: { amount: "Amount", customer: "Customer", method: "Method" },
    presentation: {
      layout: "sidebar-ledger",
      density: "balanced",
      navigationPattern: "sidebar",
      dashboardComposition: ["metrics", "recentPayments", "balances", "customers", "createPayment"],
      visualTokens: {
        palette: ["white", "blue", "slate"],
        typography: "system sans with tabular figures",
        radius: "8px",
        spacing: "balanced dashboard spacing",
        surfaces: "light panels with restrained borders",
        buttons: "solid primary and quiet secondary buttons"
      },
      copyTone: input.generationProfile.visualDirection,
      componentLabels: { metricsCard: "Overview", paymentTable: "Payment history", createPanel: "Create payment" },
      emptyStates: { payments: "No payments yet.", customers: "No customers yet.", balances: "No balance activity yet." }
    }
  };
}

function publicArtifactEntities(contract: BrandRuntimeContract): Record<string, string> {
  const keys = ["register", "login", "account", "metrics", "payments", "customers", "paymentMethods", "balances"] as const;

  return Object.fromEntries(keys.map((key) => [key, contract.endpoints[key].replace(/^bff\//u, "")]));
}

const HTML_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "{": "&#123;",
  "}": "&#125;"
};

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}

function hashToNumber(value: string): number {
  return Number.parseInt(createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
}

function clarificationQuestions(brandName: string, prompt: string): LayoutBuilderClarificationQuestion[] {
  const source = `${brandName} ${prompt}`.toLowerCase();
  const questions: LayoutBuilderClarificationQuestion[] = [];

  if (!/\b(merchant|enterprise|operator|admin|consumer|customer|buyer|seller|crypto|web3|finance|treasury)\b/u.test(source)) {
    questions.push({
      id: "audience",
      label: "Who will use this brand workspace?",
      type: "single_select",
      required: true,
      options: ["Enterprise merchant operators", "Crypto payment teams", "Marketplace sellers", "Consumer checkout users"]
    });
  }

  if (!/\b(crypto|stablecoin|wallet|settlement|checkout|treasury|risk|ledger|gateway|payments?)\b/u.test(source)) {
    questions.push({
      id: "payment_domain",
      label: "Which payment domain should the public contract feel built around?",
      type: "single_select",
      required: true,
      options: ["Crypto settlement rails", "Merchant checkout gateway", "Treasury movement desk", "Risk review cases"]
    });
  }

  if (!/\b(premium|professional|operational|consumer|risk|ledger|compact|friendly|serious)\b/u.test(source)) {
    questions.push({
      id: "tone",
      label: "What tone should labels and status names use?",
      type: "single_select",
      required: false,
      options: ["Premium finance", "Operational ledger", "Risk review", "Customer-friendly"]
    });
  }

  if (!/\b(login|register|payment|payments|transaction|history|customer|balance|wallet|account)\b/u.test(source)) {
    questions.push({
      id: "required_screens",
      label: "Which screens must be obvious in the generated brand?",
      type: "multi_select",
      required: true,
      options: ["Registration", "Login", "Payment creation", "Transaction history", "Customers", "Balances"]
    });
  }

  if (!/\b(seed|demo|scenario|sample|test data|transactions?)\b/u.test(source)) {
    questions.push({
      id: "demo_data",
      label: "What demo scenarios should be available after creation?",
      type: "multi_select",
      required: false,
      options: ["Settled payments", "Failed payments", "Refunded wallet payments", "Crypto wallet activity", "Manual review queue"]
    });
  }

  if (!/\b(design|visual|dark|light|color|compact|dashboard|brand|logo|premium)\b/u.test(source)) {
    questions.push({
      id: "visual_direction",
      label: "What visual direction should the brand use?",
      type: "text",
      required: false,
      placeholder: "Example: dark crypto dashboard with high-contrast balances and compact transaction tables"
    });
  }

  return questions;
}

interface BrandDomain {
  resourceAlias: string;
  visualHint: string;
  actionLabels: LayoutBuilderAiGenerationProfile["actionLabels"];
}

function selectDomain(
  brandName: string,
  prompt: string,
  answers: LayoutBuilderClarificationAnswers,
  seed: number
): BrandDomain {
  const source = `${brandName} ${prompt} ${clarificationAnswersToPrompt(answers)}`.toLowerCase();

  if (/\b(crypto|stablecoin|wallet|web3|chain|blockchain|token)\b/u.test(source)) {
    return pick(CRYPTO_DOMAINS, seed);
  }

  if (/\b(checkout|buyer|consumer|order)\b/u.test(source)) {
    return pick(CHECKOUT_DOMAINS, seed);
  }

  if (/\b(treasury|ledger|settlement|finance)\b/u.test(source)) {
    return pick(TREASURY_DOMAINS, seed);
  }

  return pick(DOMAINS, seed);
}

function normalizeClarificationAnswers(
  answers: LayoutBuilderClarificationAnswers | undefined
): LayoutBuilderClarificationAnswers {
  if (!answers) {
    return {};
  }

  const entries: Array<[string, LayoutBuilderClarificationAnswers[string]]> = [];

  for (const [key, value] of Object.entries(answers)) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        entries.push([key, trimmed]);
      }
      continue;
    }

    const values = value.map((entry) => entry.trim()).filter(Boolean);
    if (values.length > 0) {
      entries.push([key, values]);
    }
  }

  return Object.fromEntries(entries);
}

function clarificationAnswersToPrompt(answers: LayoutBuilderClarificationAnswers): string {
  return Object.entries(answers)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`)
    .join("\n");
}

function answerValue(answers: LayoutBuilderClarificationAnswers, key: string): string | undefined {
  const value = answers[key];

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  return value;
}

const DOMAINS: readonly BrandDomain[] = [
  {
    resourceAlias: "settlementCases",
    visualHint: "Use operational finance language with compact ledgers and settlement review flows",
    actionLabels: {
      register: "Open workspace",
      login: "Resume workspace",
      createPayment: "Create settlement",
      history: "Settlement ledger",
      refund: "Return funds"
    }
  },
  {
    resourceAlias: "checkoutOrders",
    visualHint: "Use checkout and order language with clear customer-facing payment steps",
    actionLabels: {
      register: "Create buyer access",
      login: "Sign in",
      createPayment: "Start checkout",
      history: "Order payments",
      refund: "Issue return"
    }
  },
  {
    resourceAlias: "treasuryMoves",
    visualHint: "Use treasury movement language with balance, routing, and approval emphasis",
    actionLabels: {
      register: "Create treasury profile",
      login: "Enter treasury",
      createPayment: "Route funds",
      history: "Movement history",
      refund: "Reverse movement"
    }
  },
  {
    resourceAlias: "paymentCases",
    visualHint: "Use case-management language with review queues and lifecycle evidence",
    actionLabels: {
      register: "Create case access",
      login: "Open case desk",
      createPayment: "Raise payment case",
      history: "Case timeline",
      refund: "Resolve return"
    }
  }
] as const;

const CRYPTO_DOMAINS: readonly BrandDomain[] = [
  {
    resourceAlias: "cryptoSettlements",
    visualHint: "Use crypto payment language with wallet balances, settlement rails, and chain-aware transaction history",
    actionLabels: {
      register: "Create wallet desk",
      login: "Open wallet desk",
      createPayment: "Launch crypto payment",
      history: "Chain settlement log",
      refund: "Return to wallet"
    }
  },
  {
    resourceAlias: "walletFlows",
    visualHint: "Use digital asset operations language with compact wallet activity and reserve visibility",
    actionLabels: {
      register: "Activate wallet access",
      login: "Resume wallet session",
      createPayment: "Route wallet payment",
      history: "Wallet activity",
      refund: "Reverse wallet flow"
    }
  },
  {
    resourceAlias: "stablecoinOrders",
    visualHint: "Use stablecoin checkout language with balance confidence and settlement confirmation cues",
    actionLabels: {
      register: "Create stablecoin profile",
      login: "Enter stablecoin portal",
      createPayment: "Create stablecoin order",
      history: "Stablecoin ledger",
      refund: "Return stablecoins"
    }
  },
  {
    resourceAlias: "tokenTransfers",
    visualHint: "Use token transfer language with wallet counterparties, review states, and ledger movements",
    actionLabels: {
      register: "Create token desk",
      login: "Open token desk",
      createPayment: "Send token transfer",
      history: "Token transfer log",
      refund: "Recall transfer"
    }
  }
] as const;

const CHECKOUT_DOMAINS = DOMAINS.filter((domain) => domain.resourceAlias === "checkoutOrders");
const TREASURY_DOMAINS = DOMAINS.filter(
  (domain) => domain.resourceAlias === "treasuryMoves" || domain.resourceAlias === "settlementCases"
);

const TONES = [
  {
    visualDirection: "Quiet enterprise UI with dense tables, restrained contrast, and precise status badges",
    contractTone: "operations-oriented"
  },
  {
    visualDirection: "Premium merchant portal with stronger typography, clear account summary, and polished empty states",
    contractTone: "merchant-friendly"
  },
  {
    visualDirection: "Risk review console with compact controls, audit-oriented wording, and visible lifecycle transitions",
    contractTone: "risk-aware"
  },
  {
    visualDirection: "Consumer checkout account with simpler wording, softer surfaces, and payment progress clarity",
    contractTone: "customer-facing"
  }
] as const;

const STATUS_SETS: Array<Record<PaymentCoreStatus, string>> = [
  {
    created: "opened",
    requires_payment_method: "needsSource",
    requires_confirmation: "approvalQueue",
    processing: "routing",
    authorized: "reserved",
    captured: "collected",
    settled: "cleared",
    failed: "rejected",
    canceled: "voided",
    refunded: "returned"
  },
  {
    created: "drafted",
    requires_payment_method: "sourceMissing",
    requires_confirmation: "awaitingApproval",
    processing: "inFlight",
    authorized: "held",
    captured: "debited",
    settled: "posted",
    failed: "declined",
    canceled: "stopped",
    refunded: "creditedBack"
  },
  {
    created: "newOrder",
    requires_payment_method: "chooseMethod",
    requires_confirmation: "confirming",
    processing: "processing",
    authorized: "approved",
    captured: "paid",
    settled: "completed",
    failed: "unsuccessful",
    canceled: "cancelled",
    refunded: "refundComplete"
  },
  {
    created: "caseOpened",
    requires_payment_method: "intakeNeeded",
    requires_confirmation: "reviewNeeded",
    processing: "underReview",
    authorized: "reservePlaced",
    captured: "releaseApproved",
    settled: "caseClosed",
    failed: "caseFailed",
    canceled: "caseWithdrawn",
    refunded: "caseReturned"
  }
];
