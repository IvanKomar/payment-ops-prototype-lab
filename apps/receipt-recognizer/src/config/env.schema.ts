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

export const receiptRecognizerEnvSchema = createEnvSchema({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: numberFromString(3002),
  RECEIPT_RECOGNIZER_PORT: numberFromString(3002).optional(),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public"),
  LOG_LEVEL: z.string().default("info"),
  NORMALIZER: z.enum(["regex", "gemini", "anthropic"]).default("regex"),
  GEMINI_ENABLED: booleanFromString,
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash-lite"),
  RECEIPT_MAX_UPLOAD_BYTES: numberFromString(8 * 1024 * 1024)
});

export type ReceiptRecognizerEnv = z.infer<typeof receiptRecognizerEnvSchema>;
