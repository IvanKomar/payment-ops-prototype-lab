import { Injectable } from "@nestjs/common";
import type {
  LayoutBuilderDashboardConfig,
  LayoutBuilderFieldStyle,
  LayoutBuilderPayloadStructure
} from "@payment-ops/shared-types";
import { createHash, randomUUID } from "node:crypto";

import { CANONICAL_FIELDS } from "../layout.constants.js";
import type { GeneratedSchema } from "../layout.types.js";
import { createDefaultDashboardConfig } from "../default-dashboard.js";

const FIELD_STYLES: LayoutBuilderFieldStyle[] = ["camelCase", "snake_case", "kebab-case"];
const STRUCTURES: LayoutBuilderPayloadStructure[] = ["flat", "nested", "key-value-array"];

@Injectable()
export class SchemaGeneratorService {
  generate(brandId: string, brandName: string): GeneratedSchema {
    const seed = hashToNumber(brandId);
    const fieldsStyle = FIELD_STYLES[seed % FIELD_STYLES.length]!;
    const structure = STRUCTURES[Math.floor(seed / FIELD_STYLES.length) % STRUCTURES.length]!;
    const fields = Object.fromEntries(
      CANONICAL_FIELDS.map((field) => [field, externalFieldName(field, fieldsStyle, brandId)])
    );

    return {
      id: `sch_${randomUUID().replaceAll("-", "")}`,
      brandId,
      slug: `configure_${createHash("sha1").update(`${brandId}:${brandName}`).digest("hex").slice(0, 16)}`,
      fieldsStyle,
      structure,
      fields
    };
  }

  samplePayload(schema: Pick<GeneratedSchema, "fields" | "structure">, brandName: string): unknown {
    const config = createDefaultDashboardConfig(brandName);

    if (schema.structure === "flat") {
      return toExternalFlat(schema.fields, config);
    }

    if (schema.structure === "nested") {
      return toExternalNested(schema.fields, config);
    }

    return Object.entries(toExternalFlat(schema.fields, config)).map(([key, value]) => ({ key, value }));
  }
}

function hashToNumber(value: string): number {
  return Number.parseInt(createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
}

function externalFieldName(
  canonical: string,
  style: LayoutBuilderFieldStyle,
  brandId: string
): string {
  const suffix = createHash("sha1").update(`${brandId}:${canonical}`).digest("hex").slice(0, 4);
  const base = canonical.split(".").at(-1) ?? canonical;
  const styled = applyFieldStyle(base, style);

  if (style === "kebab-case") {
    return `${styled}-${suffix}`;
  }

  return `${styled}_${suffix}`;
}

function applyFieldStyle(value: string, style: LayoutBuilderFieldStyle): string {
  const words = value.replace(/([a-z])([A-Z])/gu, "$1 $2").split(/[\s_-]+/u);

  if (style === "camelCase") {
    return words
      .map((word, index) =>
        index === 0
          ? word.toLowerCase()
          : `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`
      )
      .join("");
  }

  const separator = style === "snake_case" ? "_" : "-";
  return words.map((word) => word.toLowerCase()).join(separator);
}

function toExternalFlat(
  fields: Record<string, string>,
  config: LayoutBuilderDashboardConfig
): Record<string, unknown> {
  return Object.fromEntries(
    CANONICAL_FIELDS.map((field) => [external(fields, field), getCanonicalValue(config, field)])
  );
}

function toExternalNested(
  fields: Record<string, string>,
  config: LayoutBuilderDashboardConfig
): Record<string, unknown> {
  return {
    dashboard: {
      [external(fields, "title")]: config.title,
      [external(fields, "balance")]: config.balance,
      [external(fields, "currency")]: config.currency,
      [external(fields, "mode")]: config.mode,
      [external(fields, "searchTransactionId")]: config.searchTransactionId,
      [external(fields, "pageSize")]: config.pageSize
    },
    filters: {
      [external(fields, "filters.method")]: config.filters.method,
      [external(fields, "filters.type")]: config.filters.type,
      [external(fields, "filters.status")]: config.filters.status,
      [external(fields, "filters.dateFrom")]: config.filters.dateFrom,
      [external(fields, "filters.dateTo")]: config.filters.dateTo
    },
    [external(fields, "payments")]: config.payments
  };
}

function external(fields: Record<string, string>, canonical: string): string {
  const value = fields[canonical];

  if (!value) {
    throw new Error(`Missing generated field for ${canonical}`);
  }

  return value;
}

function getCanonicalValue(config: LayoutBuilderDashboardConfig, field: string): unknown {
  if (field.startsWith("filters.")) {
    const filterKey = field.slice("filters.".length) as keyof LayoutBuilderDashboardConfig["filters"];
    return config.filters[filterKey];
  }

  return config[field as keyof LayoutBuilderDashboardConfig];
}
