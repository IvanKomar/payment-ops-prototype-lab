import { describe, expect, it } from "vitest";
import type { LayoutBuilderAiGenerationProfile } from "@payment-ops/shared-types";

import { DEFAULT_AI_GENERATION_CONTROLS } from "../src/layouts/ai/ai-brand-spec.service.js";
import { brandSlug, SchemaGeneratorService } from "../src/layouts/schema/schema-generator.service.js";

describe("SchemaGeneratorService", () => {
  it("generates deterministic schema and sample payload for a brand", () => {
    const service = new SchemaGeneratorService();
    const schema = service.generate("br_11111111111111111111111111111111", "KOI");
    const same = service.generate("br_11111111111111111111111111111111", "KOI");

    expect(schema.slug).toEqual(same.slug);
    expect(schema.fieldsStyle).toEqual(same.fieldsStyle);
    expect(schema.structure).toEqual(same.structure);
    expect(schema.fields.title).toBeDefined();
    expect(schema.fields.payments).toBeDefined();
    expect(service.samplePayload(schema, "KOI")).toBeTruthy();
  });

  it("varies generated sample dashboard data by brand id", () => {
    const service = new SchemaGeneratorService();
    const first = service.generate("br_11111111111111111111111111111111", "KOI");
    const second = service.generate("br_22222222222222222222222222222222", "KOI");

    expect(service.samplePayload(first, "KOI")).not.toEqual(service.samplePayload(second, "KOI"));
  });

  it("normalizes cyrillic brand names for public endpoints", () => {
    expect(brandSlug("Палец в верх")).toBe("palets-v-verh");
    expect(brandSlug("Nova Ledger")).toBe("nova-ledger");
  });

  it("uses generated route language instead of the brand name for AI brand slugs", () => {
    const service = new SchemaGeneratorService();
    const profile = {
      provider: "local",
      model: "local-brand-runtime-v1",
      adminPrompt: "Create Nova Ledger",
      systemPrompt: "Generate",
      resourceAlias: "trade_items",
      visualDirection: "arcade trade flow",
      contractSummary: "Generated",
      dictionary: {
        visibility: "bff_private",
        source: "intent_compiler",
        controls: DEFAULT_AI_GENERATION_CONTROLS,
        forbiddenPublicTerms: [],
        publicRoutes: {
          register: "access-start",
          login: "access-enter",
          account: "access-seat",
          metrics: "arcade-pulse",
          payments: "loot-drop-lane",
          customers: "players-book",
          paymentMethods: "socket-vault",
          balances: "charge-stream"
        },
        requestKeys: {},
        responseKeys: {},
        fieldAliases: {},
        statusAliases: {
          created: "created",
          requires_payment_method: "requires_payment_method",
          requires_confirmation: "requires_confirmation",
          processing: "processing",
          authorized: "authorized",
          captured: "captured",
          settled: "settled",
          failed: "failed",
          canceled: "canceled",
          refunded: "refunded"
        },
        actionLabels: {},
        visualTokens: {
          layout: "card-operations",
          density: "balanced",
          navigationPattern: "command-rail",
          dashboardComposition: ["metrics"],
          palette: ["black", "lime", "white"],
          typography: "Space Grotesk",
          radius: "8px",
          spacing: "balanced",
          surfaces: "dark arcade panels",
          buttons: "lime commands"
        },
        authExperience: {} as NonNullable<LayoutBuilderAiGenerationProfile["dictionary"]>["authExperience"],
        paymentsExperience: {} as NonNullable<LayoutBuilderAiGenerationProfile["dictionary"]>["paymentsExperience"]
      },
      statusMap: {
        created: "created",
        requires_payment_method: "requires_payment_method",
        requires_confirmation: "requires_confirmation",
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
        createPayment: "Create trade",
        history: "Trade ledger",
        refund: "Refund"
      },
      generatedAt: "2026-05-25T00:00:00.000Z"
    } satisfies LayoutBuilderAiGenerationProfile;
    const schema = service.generate("br_33333333333333333333333333333333", "Nova Ledger", [], profile);

    expect(schema.slug).toMatch(/^loot-drop-lane_[a-f0-9]{16}$/u);
    expect(schema.slug).not.toContain("nova");
    expect(schema.slug).not.toContain("ledger");
  });
});
