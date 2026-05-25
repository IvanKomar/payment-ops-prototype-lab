import { describe, expect, it } from "vitest";

import { AiAgentManifestService } from "../src/layouts/ai/ai-agent-manifest.service.js";

describe("AiAgentManifestService", () => {
  const service = new AiAgentManifestService();
  const manifest = service.getManifest();

  it("describes the managed and external brand generation flows", () => {
    expect(manifest.flows).toEqual(["managed_draft", "external_spec_import", "direct_create_from_spec"]);
    expect(manifest.endpoints.map((endpoint) => endpoint.path)).toContain("/brands/ai/drafts/from-spec");
    expect(manifest.endpoints.map((endpoint) => endpoint.path)).toContain("/brands/ai/drafts/from-spec/create");
    expect(manifest.schemas.aiBrandSpec).toMatchObject({ type: "object" });
    expect(manifest.examples.aiBrandSpec.ui.presentation.layout).toBe("command-center");
  });

  it("does not expose private runtime details or secrets", () => {
    const serialized = JSON.stringify(manifest).toLowerCase();

    expect(serialized).not.toContain("database_url");
    expect(serialized).not.toContain("api_key");
    expect(serialized).not.toContain("payment-core");
    expect(serialized).not.toContain("prisma");
  });

  it("describes the minimal external chat intent flow", () => {
    const intentManifest = service.getIntentManifest();

    expect(intentManifest.recommendedFlow).toBe("external_chat_intent");
    expect(intentManifest.endpoints.map((endpoint) => endpoint.path)).toContain("/brands/intent-drafts");
    expect(intentManifest.hiddenBffConfig).toMatchObject({
      generatedBy: "layout-builder",
      storedAs: "generationProfile.dictionary"
    });
    expect(intentManifest.hiddenBffConfig.includes).toContain("fieldAliases");
    expect(intentManifest.codexPrompt.userQuestions.map((question) => question.id)).toContain("audience");
    expect(intentManifest.codexPrompt.outputContract).toContain(
      "Target one brand-facing page: /:brandSlug/app/payments with seeded payment activity."
    );
    expect(intentManifest.schema).toMatchObject({ type: "object" });
    expect(intentManifest.examples.intent.concept.paymentMetaphor).toBeTruthy();
  });
});
