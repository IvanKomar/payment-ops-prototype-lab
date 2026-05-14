import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { SmsMessage } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";

import { ProviderRegistry } from "./providers/provider-registry.js";
import type { ISmsProvider } from "./providers/provider.types.js";
import { SmsQueue } from "./queue/sms.queue.js";
import { SmsRepository } from "./sms.repository.js";
import type {
  SendSmsCommand,
  SendSmsResponse,
  SmsRecentMessageResponse,
  SmsStatusResponse
} from "./sms.types.js";

const SERVER_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class SmsService {
  constructor(
    @Inject(SmsRepository) private readonly repository: SmsRepository,
    @Inject(ProviderRegistry) private readonly providerRegistry: ProviderRegistry,
    @Inject(SmsQueue) private readonly smsQueue: SmsQueue
  ) {}

  async send(command: SendSmsCommand): Promise<SendSmsResponse> {
    const now = new Date();
    const existing = await this.repository.findRecentDuplicate({
      phoneNumber: command.phoneNumber,
      message: command.message,
      createdAfter: new Date(now.getTime() - SERVER_DEDUPE_WINDOW_MS)
    });

    if (existing) {
      return this.toDeduplicatedSendResponse(existing);
    }

    const selectedProvider = this.providerRegistry.selectProvider(command.phoneNumber);
    const idempotencyKey = this.createServerIdempotencyKey(command, now);
    const jobId = this.createJobId();

    try {
      const message = await this.repository.createQueued({
        ...command,
        id: jobId,
        idempotencyKey,
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
      if (this.repository.isUniqueConstraintError(error)) {
        const existing = await this.repository.findByIdempotencyKey(idempotencyKey);

        if (existing) {
          return this.toDeduplicatedSendResponse(existing);
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

  async listRecentMessages(limit = 10): Promise<SmsRecentMessageResponse[]> {
    const messages = await this.repository.findLatest(limit);

    return messages.map((message) => ({
      jobId: message.id,
      phoneNumber: message.phoneNumber,
      message: message.message,
      status: message.status,
      provider: message.selectedProvider,
      attempts: message.attempts,
      lastError: message.lastError,
      dedupeKey: message.idempotencyKey,
      createdAt: message.createdAt.toISOString(),
      sentAt: message.sentAt?.toISOString() ?? null
    }));
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

  private toDeduplicatedSendResponse(message: SmsMessage): SendSmsResponse {
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

  private createServerIdempotencyKey(command: SendSmsCommand, now: Date): string {
    const window = Math.floor(now.getTime() / SERVER_DEDUPE_WINDOW_MS);
    const digest = createHash("sha256")
      .update(command.phoneNumber)
      .update("\0")
      .update(command.message)
      .update("\0")
      .update(String(window))
      .digest("hex");

    return `server:${digest}`;
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
