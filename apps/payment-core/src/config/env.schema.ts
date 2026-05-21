import { createEnvSchema } from "@payment-ops/shared-config";
import { z } from "zod";

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

export const paymentCoreEnvSchema = createEnvSchema({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: numberFromString(3005),
  PAYMENT_CORE_PORT: numberFromString(3005).optional(),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public"),
  LOG_LEVEL: z.string().default("info"),
  PAYMENT_SESSION_TTL_SECONDS: numberFromString(60 * 60 * 12)
});

export type PaymentCoreEnv = z.infer<typeof paymentCoreEnvSchema>;
