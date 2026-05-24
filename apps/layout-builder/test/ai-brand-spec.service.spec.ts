import { describe, expect, it, vi } from "vitest";

import { AiBrandSpecService } from "../src/layouts/ai/ai-brand-spec.service.js";

const service = new AiBrandSpecService({
  BRAND_AI_PROVIDER: "local",
  GEMINI_ENABLED: false,
  GEMINI_MODEL: "gemini-2.5-flash-lite"
} as ConstructorParameters<typeof AiBrandSpecService>[0]);

describe("AiBrandSpecService", () => {
  it("generates a valid local brand spec", async () => {
    const spec = await service.generateSpec(
      {
        brandName: "Spec Ledger",
        adminPrompt: "Create a unique settlement gateway with disguised payload contracts"
      },
      []
    );

    expect(service.validateSpec(spec).issues).toEqual([]);
    expect(spec.entities.payments.route).not.toBe("payments");
    expect(spec.auth.tokenResponseKey).not.toBe("sessionToken");
  });

  it("rejects duplicate public routes", async () => {
    const spec = await service.generateSpec(
      {
        brandName: "Spec Ledger",
        adminPrompt: "Create a unique settlement gateway with disguised payload contracts"
      },
      []
    );

    const validation = service.validateSpec({
      ...spec,
      entities: {
        ...spec.entities,
        payments: { ...spec.entities.payments, route: spec.entities.account.route }
      }
    });

    expect(validation.spec).toBeNull();
    expect(validation.issues.join(" ")).toContain("Duplicate public route");
  });

  it("rejects reserved canonical public routes", async () => {
    const spec = await service.generateSpec(
      {
        brandName: "Spec Ledger",
        adminPrompt: "Create a unique settlement gateway with disguised payload contracts"
      },
      []
    );

    const validation = service.validateSpec({
      ...spec,
      entities: {
        ...spec.entities,
        payments: { ...spec.entities.payments, route: "payments" }
      }
    });

    expect(validation.spec).toBeNull();
    expect(validation.issues.join(" ")).toContain("Reserved public route");
  });

  it("rejects incomplete payment status maps", async () => {
    const spec = await service.generateSpec(
      {
        brandName: "Spec Ledger",
        adminPrompt: "Create a unique settlement gateway with disguised payload contracts"
      },
      []
    );
    const statuses: Partial<typeof spec.statuses> = { ...spec.statuses };
    delete statuses.refunded;

    const validation = service.validateSpec({ ...spec, statuses });

    expect(validation.spec).toBeNull();
    expect(validation.issues.join(" ")).toContain("statuses.refunded");
  });

  it("rejects specs without a UI presentation recipe", async () => {
    const spec = await service.generateSpec(
      {
        brandName: "Spec Ledger",
        adminPrompt: "Create a unique settlement gateway with disguised payload contracts"
      },
      []
    );

    const validation = service.validateSpec({
      ...spec,
      ui: {
        ...spec.ui,
        presentation: undefined
      }
    });

    expect(validation.spec).toBeNull();
    expect(validation.issues.join(" ")).toContain("ui.presentation");
  });

  it("generates and validates brand specs through Gemini when configured", async () => {
    const spec = await service.generateSpec(
      {
        brandName: "Spec Ledger",
        adminPrompt: "Create a unique settlement gateway with disguised payload contracts"
      },
      []
    );
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: vi.fn(async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(spec) }]
            }
          }
        ]
      }))
    }));
    vi.stubGlobal("fetch", fetchMock);

    const geminiService = new AiBrandSpecService({
      BRAND_AI_PROVIDER: "gemini",
      GEMINI_ENABLED: true,
      GEMINI_API_KEY: "test-key",
      GEMINI_MODEL: "gemini-2.5-flash-lite"
    } as ConstructorParameters<typeof AiBrandSpecService>[0]);

    await expect(
      geminiService.generateSpec(
        {
          brandName: "Spec Ledger",
          adminPrompt: "Create a unique settlement gateway with disguised payload contracts",
          provider: "gemini"
        },
        []
      )
    ).resolves.toEqual(spec);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "x-goog-api-key": "test-key" })
      })
    );
  });
});
