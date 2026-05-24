import { describe, expect, it } from "vitest";

import { AiAgentManifestService } from "../src/layouts/ai/ai-agent-manifest.service.js";

describe("AiAgentManifestService", () => {
  const manifest = new AiAgentManifestService().getManifest();

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
});
