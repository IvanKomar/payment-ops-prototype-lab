import { describe, expect, it } from "vitest";

import {
  createBrandDraftFromSpecSchema,
  createBrandSchema,
  regenerateContractSchema
} from "../src/layouts/dto/layout.schemas.js";
import { AiBrandSpecService } from "../src/layouts/ai/ai-brand-spec.service.js";

const specService = new AiBrandSpecService({
  BRAND_AI_PROVIDER: "local",
  GEMINI_ENABLED: false,
  GEMINI_MODEL: "gemini-2.5-flash-lite"
} as ConstructorParameters<typeof AiBrandSpecService>[0]);

describe("layout DTO schemas", () => {
  it("accepts legacy AI brand creation payloads", () => {
    const parsed = createBrandSchema.parse({
      brandName: "Nova Ledger",
      aiPrompt: "Create a merchant payment workspace",
      systemPrompt: "Use only public brand runtime contracts"
    });

    expect(parsed).toMatchObject({
      brandName: "Nova Ledger",
      aiPrompt: "Create a merchant payment workspace"
    });
  });

  it("accepts provider and clarification answers for AI brand creation", () => {
    const parsed = createBrandSchema.parse({
      brandName: "Crypto Payment Power Super",
      aiPrompt: "Create a crypto payment brand",
      aiProvider: "local",
      aiModel: "local-brand-runtime-v1",
      clarificationAnswers: JSON.stringify({
        audience: "Crypto payment teams",
        required_screens: ["Registration", "Login", "Payment creation"]
      })
    });

    expect(parsed.clarificationAnswers).toMatchObject({
      audience: "Crypto payment teams",
      required_screens: ["Registration", "Login", "Payment creation"]
    });
  });

  it("accepts provider and clarification answers for regeneration", () => {
    const parsed = regenerateContractSchema.parse({
      aiProvider: "local",
      aiModel: "local-brand-runtime-v1",
      clarificationAnswers: {
        payment_domain: "Crypto settlement rails"
      }
    });

    expect(parsed).toMatchObject({
      aiProvider: "local",
      aiModel: "local-brand-runtime-v1"
    });
  });

  it("accepts externally generated brand specs for import", async () => {
    const spec = await specService.generateSpec(
      {
        brandName: "External Vault",
        adminPrompt: "Create an external AI generated payment brand"
      },
      []
    );
    const parsed = createBrandDraftFromSpecSchema.parse({
      brandName: "External Vault",
      provider: "codex",
      spec
    });

    expect(parsed.provider).toBe("codex");
    expect(parsed.spec).toMatchObject({
      resourceAlias: spec.resourceAlias
    });
  });
});
