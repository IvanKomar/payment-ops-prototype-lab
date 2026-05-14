import type { ISmsProvider, SmsProviderStatus, SmsSendInput, SmsSendResult } from "./provider.types.js";

interface Fast2SmsProviderOptions {
  apiKey: string;
  endpoint?: string;
}

export class Fast2SmsProvider implements ISmsProvider {
  readonly name = "Fast2SmsProvider";
  private readonly endpoint: string;

  constructor(private readonly options: Fast2SmsProviderOptions) {
    this.endpoint = options.endpoint ?? "https://www.fast2sms.com/dev/bulkV2";
  }

  canHandle(phoneNumber: string): boolean {
    return phoneNumber.startsWith("+91");
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        authorization: this.options.apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        route: "q",
        message: input.message,
        numbers: input.phoneNumber.replace(/^\+91/, "")
      })
    });

    if (!response.ok) {
      throw new Error(`Fast2SMS request failed with ${response.status}`);
    }

    const payload = await response.json();

    return {
      providerMessageId: this.extractMessageId(payload),
      status: "sent"
    };
  }

  async getStatus(providerMessageId: string): Promise<SmsProviderStatus> {
    return {
      status: providerMessageId.length > 0 ? "sent" : "failed",
      lastError: null
    };
  }

  private extractMessageId(payload: unknown): string {
    if (typeof payload === "object" && payload !== null) {
      const record = payload as Record<string, unknown>;

      if (typeof record.request_id === "string") {
        return record.request_id;
      }

      if (typeof record.message_id === "string") {
        return record.message_id;
      }
    }

    return `fast2sms_${Date.now()}`;
  }
}
