import { randomUUID } from "node:crypto";

import type {
  ISmsProvider,
  MockSmsProviderConfig,
  SmsProviderStatus,
  SmsSendInput,
  SmsSendResult
} from "./provider.types.js";

export abstract class MockSmsProviderBase implements ISmsProvider {
  abstract readonly name: string;

  constructor(private readonly config: MockSmsProviderConfig) {}

  abstract canHandle(phoneNumber: string): boolean;

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    await this.sleep(this.getLatency());

    if (this.shouldFail(input)) {
      throw new Error(`${this.name} simulated delivery failure`);
    }

    return {
      providerMessageId: `${this.name.toLowerCase()}_${randomUUID()}`,
      status: "sent"
    };
  }

  async getStatus(providerMessageId: string): Promise<SmsProviderStatus> {
    return {
      status: providerMessageId.length > 0 ? "sent" : "failed",
      lastError: null
    };
  }

  private shouldFail(input: SmsSendInput): boolean {
    if (
      this.config.forcedFailures?.has("*") ||
      this.config.forcedFailures?.has(input.phoneNumber) ||
      this.config.forcedFailures?.has(this.name)
    ) {
      return true;
    }

    return Math.random() > this.config.successRate;
  }

  private getLatency(): number {
    const minLatency = Math.max(0, this.config.minLatencyMs);
    const maxLatency = Math.max(minLatency, this.config.maxLatencyMs);

    if (maxLatency === minLatency) {
      return minLatency;
    }

    return Math.floor(minLatency + Math.random() * (maxLatency - minLatency));
  }

  private sleep(durationMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }
}
