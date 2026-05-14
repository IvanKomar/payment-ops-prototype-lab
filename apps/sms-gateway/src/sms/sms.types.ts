import type { SmsStatus } from "@prisma/client";

export interface SendSmsCommand {
  phoneNumber: string;
  message: string;
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

export interface SmsRecentMessageResponse extends SmsStatusResponse {
  phoneNumber: string;
  message: string;
  dedupeKey: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface SmsQueueJobData {
  jobId: string;
}
