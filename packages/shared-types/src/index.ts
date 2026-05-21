export interface HealthResponse {
  service: string;
  status: "ok" | "degraded";
  uptimeSeconds: number;
  timestamp: string;
  dependencies?: Record<string, ProviderStatus>;
}

export type ProviderStatus = "available" | "degraded" | "unavailable";

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export type * from "./sms-gateway.js";
export type * from "./receipt-recognizer.js";
export type * from "./layout-builder.js";
export type * from "./payment-core.js";
