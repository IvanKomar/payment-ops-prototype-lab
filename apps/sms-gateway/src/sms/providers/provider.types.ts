export type SmsProviderDeliveryStatus = "queued" | "sent" | "failed";

export interface SmsSendInput {
  phoneNumber: string;
  message: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface SmsSendResult {
  providerMessageId: string;
  status: SmsProviderDeliveryStatus;
}

export interface SmsProviderStatus {
  status: SmsProviderDeliveryStatus;
  lastError: string | null;
}

export interface ISmsProvider {
  readonly name: string;
  canHandle(phoneNumber: string): boolean;
  send(input: SmsSendInput): Promise<SmsSendResult>;
  getStatus(providerMessageId: string): Promise<SmsProviderStatus>;
}

export interface MockSmsProviderConfig {
  successRate: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  forcedFailures?: Set<string>;
}
