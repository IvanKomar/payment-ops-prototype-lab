import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { AiBrandGeneratorService } from "../src/layouts/ai/ai-brand-generator.service.js";
import { AiBrandProviderRegistryService } from "../src/layouts/ai/ai-brand-provider-registry.service.js";

describe("AiBrandProviderRegistryService", () => {
  it("selects the local provider by default", () => {
    const registry = registryFixture();

    const profile = registry.generateProfile({
      brandId: "br_00000000000000000000000000000001",
      brandName: "Crypto Payment Power Super",
      adminPrompt: "Create a crypto payment gateway for merchant operators",
      clarificationAnswers: {
        audience: "Crypto payment teams",
        payment_domain: "Crypto settlement rails"
      }
    });

    expect(profile.provider).toBe("local");
    expect(profile.credentialMode).toBe("none");
    expect(profile.model).toBe("local-brand-runtime-v1");
    expect(profile.clarificationAnswers).toMatchObject({
      audience: "Crypto payment teams"
    });
    expect(["cryptoSettlements", "walletFlows", "stablecoinOrders", "tokenTransfers"]).toContain(profile.resourceAlias);
  });

  it("returns useful clarification questions for sparse prompts", () => {
    const registry = registryFixture();

    const response = registry.clarify({
      brandName: "Power Super",
      aiPrompt: "Make a brand"
    });

    expect(response.aiProvider).toBe("local");
    expect(response.readyToGenerate).toBe(false);
    expect(response.questions.map((question) => question.id)).toEqual(
      expect.arrayContaining(["audience", "payment_domain", "required_screens"])
    );
  });

  it("returns fewer clarification questions when the prompt is specific", () => {
    const registry = registryFixture();

    const response = registry.clarify({
      brandName: "Crypto Payment Power Super",
      aiPrompt:
        "Create a premium crypto payment gateway for merchant operators with login, registration, wallet balances, payment creation, customers, transaction history, seeded demo settlement scenarios, and dark compact dashboard design."
    });

    expect(response.questions.length).toBeLessThanOrEqual(1);
  });

  it("fails clearly when an external provider is not configured", () => {
    const registry = registryFixture();

    expect(() =>
      registry.generateProfile({
        brandId: "br_00000000000000000000000000000001",
        brandName: "Nova Ledger",
        adminPrompt: "Create a payment brand",
        aiProvider: "gemini"
      })
    ).toThrow(BadRequestException);
  });
});

function registryFixture(): AiBrandProviderRegistryService {
  return new AiBrandProviderRegistryService(new AiBrandGeneratorService());
}
