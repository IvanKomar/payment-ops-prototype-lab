import { createEnvSchema } from "@payment-ops/shared-config";
import { z } from "zod";

const booleanFromString = z
  .string()
  .default("false")
  .transform((value) => value === "true");

const numberFromString = (defaultValue: number) =>
  z
    .string()
    .default(String(defaultValue))
    .transform((value, context) => {
      const parsed = Number(value);

      if (!Number.isFinite(parsed)) {
        context.addIssue({
          code: "custom",
          message: "Expected a finite number"
        });
        return z.NEVER;
      }

      return parsed;
    });

export const smsGatewayEnvSchema = createEnvSchema({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: numberFromString(3001),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  LOG_LEVEL: z.string().default("info"),
  SMS_MOCK_MIN_LATENCY_MS: numberFromString(100),
  SMS_MOCK_MAX_LATENCY_MS: numberFromString(800),
  SMS_MOCK_SUCCESS_RATE: numberFromString(0.95),
  FAST2SMS_ENABLED: booleanFromString,
  FAST2SMS_API_KEY: z.string().optional()
});

export type SmsGatewayEnv = z.infer<typeof smsGatewayEnvSchema>;
