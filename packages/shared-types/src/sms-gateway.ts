export interface SmsGatewaySendSmsRequest {
  phoneNumber: string;
  message: string;
  metadata?: Record<string, unknown>;
}
