import type { SmsMessage } from "@prisma/client";
import { SmsStatus } from "@prisma/client";
import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import type { ISmsProvider, SmsProviderStatus, SmsSendResult } from "../src/sms/providers/provider.types.js";
import type { ProviderRegistry } from "../src/sms/providers/provider-registry.js";
import type { SmsQueue } from "../src/sms/queue/sms.queue.js";
import type { SmsRepository } from "../src/sms/sms.repository.js";
import { SmsService } from "../src/sms/sms.service.js";

class FakeProvider implements ISmsProvider {
  constructor(
    readonly name: string,
    private readonly shouldFail: boolean
  ) {}

  canHandle(): boolean {
    return true;
  }

  async send(): Promise<SmsSendResult> {
    if (this.shouldFail) {
      throw new Error("forced failure");
    }

    return {
      providerMessageId: `${this.name}_message`,
      status: "sent"
    };
  }

  async getStatus(): Promise<SmsProviderStatus> {
    return {
      status: "sent",
      lastError: null
    };
  }
}

function createMessage(overrides: Partial<SmsMessage> = {}): SmsMessage {
  return {
    id: "sms_test",
    phoneNumber: "+919876543210",
    message: "Your OTP is 123456",
    idempotencyKey: "otp-login-usr_123",
    metadata: null,
    status: SmsStatus.queued,
    selectedProvider: "Fast2SmsMockProvider",
    providerMessageId: null,
    attempts: 0,
    lastError: null,
    createdAt: new Date("2026-05-13T17:30:00.000Z"),
    updatedAt: new Date("2026-05-13T17:30:00.000Z"),
    sentAt: null,
    ...overrides
  };
}

describe("SmsService fallback and idempotency", () => {
  it("tries the next provider when the selected provider fails", async () => {
    const message = createMessage();
    const repository = {
      findById: vi.fn(async () => message),
      markProcessing: vi.fn(async () => message),
      markSent: vi.fn(async () => createMessage({ status: SmsStatus.sent, selectedProvider: "TwilioMockProvider" })),
      recordProviderFailure: vi.fn(async () => createMessage({ attempts: 1 })),
      markFailed: vi.fn(async () => createMessage({ status: SmsStatus.failed }))
    };
    const registry = {
      getFallbackProviders: vi.fn(() => [
        new FakeProvider("Fast2SmsMockProvider", true),
        new FakeProvider("TwilioMockProvider", false)
      ])
    };
    const queue = {
      enqueue: vi.fn()
    };
    const service = new SmsService(
      repository as unknown as SmsRepository,
      registry as unknown as ProviderRegistry,
      queue as unknown as SmsQueue
    );

    await service.processQueuedMessage(message.id);

    expect(repository.recordProviderFailure).toHaveBeenCalledWith(
      message.id,
      "Fast2SmsMockProvider",
      "Fast2SmsMockProvider: forced failure"
    );
    expect(repository.markSent).toHaveBeenCalledWith(message.id, "TwilioMockProvider", "TwilioMockProvider_message");
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it("returns an existing job for an equivalent idempotency key without enqueueing", async () => {
    const existing = createMessage();
    const repository = {
      findByIdempotencyKey: vi.fn(async () => existing),
      isUniqueConstraintError: vi.fn(() => false)
    };
    const registry = {
      selectProvider: vi.fn()
    };
    const queue = {
      enqueue: vi.fn()
    };
    const service = new SmsService(
      repository as unknown as SmsRepository,
      registry as unknown as ProviderRegistry,
      queue as unknown as SmsQueue
    );

    const response = await service.send({
      phoneNumber: existing.phoneNumber,
      message: existing.message,
      idempotencyKey: "otp-login-usr_123"
    });

    expect(response).toEqual({
      jobId: existing.id,
      status: existing.status,
      provider: existing.selectedProvider,
      deduplicated: true
    });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it("rejects conflicting idempotency key reuse", async () => {
    const existing = createMessage();
    const repository = {
      findByIdempotencyKey: vi.fn(async () => existing),
      isUniqueConstraintError: vi.fn(() => false)
    };
    const service = new SmsService(
      repository as unknown as SmsRepository,
      {} as unknown as ProviderRegistry,
      {} as unknown as SmsQueue
    );

    await expect(
      service.send({
        phoneNumber: existing.phoneNumber,
        message: "Different message",
        idempotencyKey: "otp-login-usr_123"
      })
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
