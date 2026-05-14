import { afterEach, describe, expect, it, vi } from "vitest";

import { Fast2SmsProvider } from "../src/sms/providers/fast2sms.provider.js";

describe("Fast2SmsProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the authorization header and strips the +91 country prefix", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ request_id: "fast2sms_request_1" })
    }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new Fast2SmsProvider({
      apiKey: "test-api-key",
      endpoint: "https://example.test/bulkV2"
    });

    const result = await provider.send({
      phoneNumber: "+919876543210",
      message: "Your OTP is 123456"
    });

    expect(result).toEqual({
      providerMessageId: "fast2sms_request_1",
      status: "sent"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/bulkV2",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "test-api-key",
          "content-type": "application/json"
        }),
        body: JSON.stringify({
          route: "q",
          message: "Your OTP is 123456",
          numbers: "9876543210"
        })
      })
    );
  });
});
