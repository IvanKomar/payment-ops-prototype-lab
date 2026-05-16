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

export const layoutBuilderEnvSchema = createEnvSchema({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: numberFromString(3003),
  LAYOUT_BUILDER_PORT: numberFromString(3003).optional(),
  DATABASE_URL: z
    .string()
    .default("postgresql://postgres:postgres@localhost:5432/payment_ops?schema=public"),
  LOG_LEVEL: z.string().default("info"),
  LAYOUT_LOGO_UPLOAD_DIR: z.string().default("uploads/logos"),
  LAYOUT_MAX_UPLOAD_BYTES: numberFromString(3 * 1024 * 1024)
});

export type LayoutBuilderEnv = z.infer<typeof layoutBuilderEnvSchema>;
