import type { SmsStatus } from "@prisma/client";

export interface SendSmsCommand {
  phoneNumber: string;
  message: string;
  idempotencyKey?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface SendSmsResponse {
  jobId: string;
  status: SmsStatus;
  provider: string;
  deduplicated: boolean;
}

export interface SmsStatusResponse {
  jobId: string;
  status: SmsStatus;
  provider: string;
  attempts: number;
  lastError: string | null;
}

export interface SmsQueueJobData {
  jobId: string;
}
