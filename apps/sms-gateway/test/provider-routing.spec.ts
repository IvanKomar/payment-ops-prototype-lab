import { describe, expect, it } from "vitest";

import { ProviderRegistry } from "../src/sms/providers/provider-registry.js";
import { createTestConfig } from "./test-helpers.js";

describe("ProviderRegistry", () => {
  it.each([
    ["+380671234567", "KyivstarMockProvider"],
    ["+919876543210", "Fast2SmsMockProvider"],
    ["+4915112345678", "VonageMockProvider"],
    ["+33612345678", "VonageMockProvider"],
    ["+447700900123", "VonageMockProvider"],
    ["+15551234567", "TwilioMockProvider"],
    ["+5511987654321", "TwilioMockProvider"],
    ["+819012345678", "TwilioMockProvider"],
    ["+61234567890", "TwilioMockProvider"]
  ])("routes %s to %s", (phoneNumber, expectedProvider) => {
    const registry = new ProviderRegistry(createTestConfig());

    expect(registry.selectProvider(phoneNumber).name).toBe(expectedProvider);
  });

  it("uses the real Fast2SMS adapter only when enabled with an API key", () => {
    const registry = new ProviderRegistry(
      createTestConfig({
        FAST2SMS_ENABLED: true,
        FAST2SMS_API_KEY: "test-key"
      })
    );

    expect(registry.selectProvider("+919876543210").name).toBe("Fast2SmsProvider");
  });

  it("falls back to the mock Fast2SMS provider when the key is missing", () => {
    const registry = new ProviderRegistry(
      createTestConfig({
        FAST2SMS_ENABLED: true,
        FAST2SMS_API_KEY: undefined
      })
    );

    expect(registry.selectProvider("+919876543210").name).toBe("Fast2SmsMockProvider");
  });
});
