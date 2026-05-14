import type { SmsGatewayEnv } from "../src/config/env.schema.js";

export function createTestConfig(overrides: Partial<SmsGatewayEnv> = {}): SmsGatewayEnv {
  return {
    NODE_ENV: "test",
    PORT: 3001,
    DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public",
    REDIS_URL: "redis://localhost:6379",
    LOG_LEVEL: "silent",
    SMS_MOCK_MIN_LATENCY_MS: 0,
    SMS_MOCK_MAX_LATENCY_MS: 0,
    SMS_MOCK_SUCCESS_RATE: 1,
    FAST2SMS_ENABLED: false,
    ...overrides
  };
}
