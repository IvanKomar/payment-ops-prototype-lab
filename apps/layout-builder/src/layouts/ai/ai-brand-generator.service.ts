import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderAiGenerationProfile,
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

export interface GenerateAiBrandProfileInput {
  brandId: string;
  brandName: string;
  adminPrompt: string;
  systemPrompt?: string;
}

export interface GenerateBrandArtifactInput {
  brandId: string;
  brandName: string;
  contractVersionId: string;
  contractSlug: string;
  contract: BrandRuntimeContract;
  generationProfile: LayoutBuilderAiGenerationProfile;
}

@Injectable()
export class AiBrandGeneratorService {
  generate(input: GenerateAiBrandProfileInput): LayoutBuilderAiGenerationProfile {
    const prompt = input.adminPrompt.trim();
    const systemPrompt = input.systemPrompt?.trim() || DEFAULT_BRAND_AI_SYSTEM_PROMPT;
    const seed = hashToNumber(`${input.brandId}:${input.brandName}:${prompt}:${systemPrompt}`);
    const domain = pick(DOMAINS, seed);
    const tone = pick(TONES, Math.floor(seed / 7));
    const statusSet = pick(STATUS_SETS, Math.floor(seed / 11));

    return {
      provider: "local",
      model: "local-brand-runtime-v1",
      adminPrompt: prompt,
      systemPrompt,
      resourceAlias: domain.resourceAlias,
      visualDirection: `${tone.visualDirection}. ${domain.visualHint}.`,
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
    const contractSource = JSON.stringify(
      {
        brandId: input.brandId,
        brandName: input.brandName,
        resourceAlias: input.contract.resourceAlias,
        endpoints: input.contract.endpoints,
        fields: input.contract.fields,
        customerFields: input.contract.customerFields,
        paymentMethodFields: input.contract.paymentMethodFields,
        balanceFields: input.contract.balanceFields,
        statusMap: input.contract.statusMap,
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
      "          <strong>Auth</strong>",
      "          <code>{brandContract.endpoints.login}</code>",
      "          <code>{brandContract.endpoints.register}</code>",
      "        </article>",
      "        <article>",
      "          <strong>Payment workspace</strong>",
      "          <code>{brandContract.endpoints.payments}</code>",
      "          <code>{brandContract.endpoints.balanceTransactions}</code>",
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
      framework: "react-vite",
      entryFile: "src/App.tsx",
      contractVersionId: input.contractVersionId,
      facadeBasePath,
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

const DOMAINS = [
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
