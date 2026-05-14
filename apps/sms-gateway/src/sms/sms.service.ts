import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { SmsMessage } from "@prisma/client";
import { randomUUID } from "node:crypto";

import { ProviderRegistry } from "./providers/provider-registry.js";
import type { ISmsProvider } from "./providers/provider.types.js";
import { SmsQueue } from "./queue/sms.queue.js";
import { SmsRepository } from "./sms.repository.js";
import type { SendSmsCommand, SendSmsResponse, SmsStatusResponse } from "./sms.types.js";

@Injectable()
export class SmsService {
  constructor(
    @Inject(SmsRepository) private readonly repository: SmsRepository,
    @Inject(ProviderRegistry) private readonly providerRegistry: ProviderRegistry,
    @Inject(SmsQueue) private readonly smsQueue: SmsQueue
  ) {}

  async send(command: SendSmsCommand): Promise<SendSmsResponse> {
    if (command.idempotencyKey) {
      const existing = await this.repository.findByIdempotencyKey(command.idempotencyKey);

      if (existing) {
        return this.toDeduplicatedSendResponse(existing, command);
      }
    }

    const selectedProvider = this.providerRegistry.selectProvider(command.phoneNumber);
    const jobId = this.createJobId();

    try {
      const message = await this.repository.createQueued({
        ...command,
        id: jobId,
        selectedProvider: selectedProvider.name
      });

      await this.smsQueue.enqueue(message.id);

      return {
        jobId: message.id,
        status: message.status,
        provider: message.selectedProvider,
        deduplicated: false
      };
    } catch (error) {
      if (command.idempotencyKey && this.repository.isUniqueConstraintError(error)) {
        const existing = await this.repository.findByIdempotencyKey(command.idempotencyKey);

        if (existing) {
          return this.toDeduplicatedSendResponse(existing, command);
        }
      }

      throw error;
    }
  }

  async getStatus(jobId: string): Promise<SmsStatusResponse> {
    const message = await this.repository.findById(jobId);

    if (!message) {
      throw new NotFoundException(`SMS job not found: ${jobId}`);
    }

    return {
      jobId: message.id,
      status: message.status,
      provider: message.selectedProvider,
      attempts: message.attempts,
      lastError: message.lastError
    };
  }

  async processQueuedMessage(jobId: string): Promise<void> {
    const message = await this.repository.findById(jobId);

    if (!message || message.status === "sent") {
      return;
    }

    await this.repository.markProcessing(jobId);

    const failedProviders = new Set<string>();
    let lastError = "No SMS provider attempted delivery";

    for (const provider of this.providerRegistry.getFallbackProviders(message.phoneNumber, failedProviders)) {
      try {
        const result = await provider.send({
          phoneNumber: message.phoneNumber,
          message: message.message,
          metadata: this.parseMetadata(message.metadata)
        });

        await this.repository.markSent(jobId, provider.name, result.providerMessageId);
        return;
      } catch (error) {
        lastError = this.formatProviderError(provider, error);
        failedProviders.add(provider.name);
        await this.repository.recordProviderFailure(jobId, provider.name, lastError);
      }
    }

    await this.repository.markFailed(jobId, lastError);
  }

  private toDeduplicatedSendResponse(message: SmsMessage, command: SendSmsCommand): SendSmsResponse {
    if (message.phoneNumber !== command.phoneNumber || message.message !== command.message) {
      throw new ConflictException("Idempotency-Key is already used for a different SMS payload");
    }

    return {
      jobId: message.id,
      status: message.status,
      provider: message.selectedProvider,
      deduplicated: true
    };
  }

  private createJobId(): string {
    return `sms_${randomUUID().replaceAll("-", "")}`;
  }

  private formatProviderError(provider: ISmsProvider, error: unknown): string {
    const message = error instanceof Error ? error.message : "Unknown SMS provider error";
    return `${provider.name}: ${message}`;
  }

  private parseMetadata(metadata: unknown): Record<string, unknown> | undefined {
    if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
      return metadata as Record<string, unknown>;
    }

    return undefined;
  }
}
