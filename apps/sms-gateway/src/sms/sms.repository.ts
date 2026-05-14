import { Injectable } from "@nestjs/common";
import { Prisma, SmsStatus, type PrismaClient, type SmsMessage } from "@prisma/client";

import type { SendSmsCommand } from "./sms.types.js";

interface CreateQueuedMessageInput extends SendSmsCommand {
  id: string;
  idempotencyKey: string;
  selectedProvider: string;
}

interface FindRecentDuplicateInput {
  phoneNumber: string;
  message: string;
  createdAfter: Date;
}

@Injectable()
export class SmsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<SmsMessage | null> {
    return this.prisma.smsMessage.findUnique({
      where: { id }
    });
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<SmsMessage | null> {
    return this.prisma.smsMessage.findUnique({
      where: { idempotencyKey }
    });
  }

  findRecentDuplicate(input: FindRecentDuplicateInput): Promise<SmsMessage | null> {
    return this.prisma.smsMessage.findFirst({
      where: {
        phoneNumber: input.phoneNumber,
        message: input.message,
        createdAt: {
          gte: input.createdAfter
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  findLatest(limit = 10): Promise<SmsMessage[]> {
    return this.prisma.smsMessage.findMany({
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });
  }

  createQueued(input: CreateQueuedMessageInput): Promise<SmsMessage> {
    const data: Prisma.SmsMessageCreateInput = {
      id: input.id,
      phoneNumber: input.phoneNumber,
      message: input.message,
      idempotencyKey: input.idempotencyKey,
      status: SmsStatus.queued,
      selectedProvider: input.selectedProvider
    };

    if (input.metadata !== undefined) {
      data.metadata = this.toJson(input.metadata);
    }

    return this.prisma.smsMessage.create({
      data
    });
  }

  markProcessing(id: string): Promise<SmsMessage> {
    return this.prisma.smsMessage.update({
      where: { id },
      data: {
        status: SmsStatus.processing
      }
    });
  }

  markSent(id: string, providerName: string, providerMessageId: string): Promise<SmsMessage> {
    return this.prisma.smsMessage.update({
      where: { id },
      data: {
        status: SmsStatus.sent,
        selectedProvider: providerName,
        providerMessageId,
        attempts: {
          increment: 1
        },
        lastError: null,
        sentAt: new Date()
      }
    });
  }

  recordProviderFailure(id: string, providerName: string, error: string): Promise<SmsMessage> {
    return this.prisma.smsMessage.update({
      where: { id },
      data: {
        selectedProvider: providerName,
        attempts: {
          increment: 1
        },
        lastError: error
      }
    });
  }

  markFailed(id: string, error: string): Promise<SmsMessage> {
    return this.prisma.smsMessage.update({
      where: { id },
      data: {
        status: SmsStatus.failed,
        lastError: error
      }
    });
  }

  isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private toJson(value: Record<string, unknown>): Prisma.InputJsonValue {
    return value as Prisma.InputJsonValue;
  }
}
