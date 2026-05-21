import { Injectable } from "@nestjs/common";
import type { LayoutBuilderAiGenerationProfile, PaymentCoreStatus } from "@payment-ops/shared-types";
import { createHash } from "node:crypto";

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
}

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
