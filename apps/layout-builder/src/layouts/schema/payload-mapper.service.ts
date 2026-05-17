import { BadRequestException, Injectable } from "@nestjs/common";
import type { LayoutBuilderDashboardConfig, LayoutBuilderPaymentRow } from "@payment-ops/shared-types";
import { z } from "zod";

import { CANONICAL_FIELDS } from "../layout.constants.js";
import type { GeneratedSchema } from "../layout.types.js";

const paymentRowSchema = z.object({
  transactionId: z.string().trim().min(1),
  status: z.enum(["created", "pending", "paid", "failed", "refunded"]),
  requestedAmount: z.coerce.number().finite().nonnegative(),
  paidAmount: z.coerce.number().finite().nonnegative(),
  createdAt: z.string().trim().min(1),
  paidAt: z.string().trim().min(1).nullable()
});

const dashboardConfigSchema = z.object({
  title: z.string().trim().min(1).max(120),
  balance: z.coerce.number().finite(),
  currency: z.string().trim().min(3).max(8),
  pageSize: z.coerce.number().int().min(1).max(100),
  payments: z.array(paymentRowSchema).min(1).max(50)
});

@Injectable()
export class PayloadMapperService {
  toCanonical(schema: GeneratedSchema, payload: unknown): LayoutBuilderDashboardConfig {
    const flat = this.toFlatExternalPayload(schema, payload);
    const candidate = {
      title: flat[external(schema, "title")],
      balance: flat[external(schema, "balance")],
      currency: flat[external(schema, "currency")],
      pageSize: flat[external(schema, "pageSize")],
      payments: flat[external(schema, "payments")]
    };
    const result = dashboardConfigSchema.safeParse(candidate);

    if (!result.success) {
      throw new BadRequestException({
        message: "Dynamic payload validation failed",
        issues: result.error.issues
      });
    }

    return result.data;
  }

  toExternal(schema: GeneratedSchema, config: LayoutBuilderDashboardConfig): unknown {
    const flat = Object.fromEntries(
      CANONICAL_FIELDS.map((field) => [external(schema, field), getCanonicalValue(config, field)])
    );

    if (schema.structure === "flat") {
      return flat;
    }

    if (schema.structure === "key-value-array") {
      return Object.entries(flat).map(([key, value]) => ({ key, value }));
    }

    return {
      dashboard: {
        [external(schema, "title")]: config.title,
        [external(schema, "balance")]: config.balance,
        [external(schema, "currency")]: config.currency,
        [external(schema, "pageSize")]: config.pageSize
      },
      [external(schema, "payments")]: config.payments
    };
  }

  private toFlatExternalPayload(schema: GeneratedSchema, payload: unknown): Record<string, unknown> {
    if (schema.structure === "flat") {
      return objectPayload(payload);
    }

    if (schema.structure === "key-value-array") {
      return keyValuePayload(payload);
    }

    const nested = objectPayload(payload);
    return {
      ...objectPayload(nested.dashboard),
      [external(schema, "payments")]: nested[external(schema, "payments")]
    };
  }
}

function external(schema: GeneratedSchema, canonical: string): string {
  const value = schema.fields[canonical];

  if (!value) {
    throw new BadRequestException(`Schema is missing generated field for ${canonical}`);
  }

  return value;
}

function objectPayload(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("Expected object payload");
  }

  return value as Record<string, unknown>;
}

function keyValuePayload(value: unknown): Record<string, unknown> {
  if (!Array.isArray(value)) {
    throw new BadRequestException("Expected key-value-array payload");
  }

  return Object.fromEntries(
    value.map((entry) => {
      const item = objectPayload(entry);
      return [String(item.key), item.value];
    })
  );
}

function getCanonicalValue(config: LayoutBuilderDashboardConfig, field: string): unknown {
  return config[field as keyof LayoutBuilderDashboardConfig];
}

export function canonicalFieldsForTests(): readonly string[] {
  return CANONICAL_FIELDS;
}

export type ParsedDashboardConfig = LayoutBuilderDashboardConfig;
export type ParsedPaymentRow = LayoutBuilderPaymentRow;
