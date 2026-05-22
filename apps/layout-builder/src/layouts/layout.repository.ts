import { Inject, Injectable } from "@nestjs/common";
import type { Brand, BrandBffRequestLog, BrandRequest, BrandSchema, Prisma } from "@prisma/client";
import type {
  LayoutBuilderAiGenerationProfile,
  LayoutBuilderDashboardConfig,
  LayoutBuilderGeneratedBrandArtifact,
  LayoutBuilderPalette
} from "@payment-ops/shared-types";

import { PrismaService } from "../prisma/prisma.service.js";
import { createLayoutProfile, type LayoutProfile } from "./render/layout-profile.js";
import type {
  BrandWithSchema,
  CreateBrandInput,
  GeneratedSchema,
  SaveBffRequestLogInput,
  SaveBrandRequestInput
} from "./layout.types.js";

type BrandWithRelations = Brand & {
  schemas: BrandSchema[];
};

@Injectable()
export class LayoutRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createBrand(input: CreateBrandInput): Promise<BrandWithSchema> {
    const brand = await this.prisma.brand.create({
      data: {
        id: input.schema.brandId,
        name: input.name,
        logoOriginalFilename: input.logo.originalFilename,
        logoMimeType: input.logo.mimeType,
        logoSizeBytes: input.logo.sizeBytes,
        logoPath: input.logo.path,
        palette: input.palette as unknown as Prisma.InputJsonValue,
        schemas: {
          create: {
            id: input.schema.id,
            slug: input.schema.slug,
            fieldsStyle: input.schema.fieldsStyle,
            structure: input.schema.structure,
            fields: {
              mappings: input.schema.fields,
              templateProfile: input.schema.templateProfile,
              generationProfile: input.schema.generationProfile,
              generatedArtifact: input.schema.generatedArtifact
            } as unknown as Prisma.InputJsonValue
          }
        }
      },
      include: {
        schemas: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    return toBrandWithSchema(brand);
  }

  async findBrand(id: string): Promise<BrandWithSchema | null> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: {
        schemas: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    return brand ? toBrandWithSchema(brand) : null;
  }

  async findLatestBrands(limit: number): Promise<BrandWithSchema[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      take: limit,
      include: {
        schemas: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    return brands.map(toBrandWithSchema);
  }

  async findLatestRequest(brandId: string): Promise<BrandRequest | null> {
    return this.prisma.brandRequest.findFirst({
      where: { brandId },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  async saveBrandRequest(input: SaveBrandRequestInput): Promise<BrandRequest> {
    return this.prisma.brandRequest.create({
      data: {
        id: input.id,
        brandId: input.brandId,
        schemaId: input.schemaId,
        originalPayload: input.originalPayload as Prisma.InputJsonValue,
        canonicalPayload: input.canonicalPayload as unknown as Prisma.InputJsonValue,
        renderedSvg: input.renderedSvg
      }
    });
  }

  async saveBffRequestLog(input: SaveBffRequestLogInput): Promise<BrandBffRequestLog> {
    return this.prisma.brandBffRequestLog.create({
      data: {
        id: input.id,
        brandId: input.brandId,
        schemaId: input.schemaId,
        method: input.method,
        alias: input.alias,
        publicEndpoint: input.publicEndpoint,
        operation: input.operation,
        status: input.status,
        requestPayload: input.requestPayload as Prisma.InputJsonValue,
        responseSummary: input.responseSummary as Prisma.InputJsonValue,
        errorMessage: input.errorMessage,
        durationMs: input.durationMs
      }
    });
  }

  async findRecentBffRequestLogs(brandId: string, limit: number): Promise<BrandBffRequestLog[]> {
    return this.prisma.brandBffRequestLog.findMany({
      where: { brandId },
      orderBy: {
        createdAt: "desc"
      },
      take: limit
    });
  }

  async deleteBrand(id: string): Promise<void> {
    await this.prisma.brand.delete({
      where: { id }
    });
  }
}

function toBrandWithSchema(brand: BrandWithRelations): BrandWithSchema {
  const schema = brand.schemas[0];

  if (!schema) {
    throw new Error(`Brand has no schema: ${brand.id}`);
  }

  const parsedFields = parseSchemaFields(schema.fields, brand.id);

  return {
    id: brand.id,
    name: brand.name,
    logoOriginalFilename: brand.logoOriginalFilename,
    logoMimeType: brand.logoMimeType,
    logoSizeBytes: brand.logoSizeBytes,
    logoPath: brand.logoPath,
    palette: brand.palette as unknown as LayoutBuilderPalette,
    createdAt: brand.createdAt,
    updatedAt: brand.updatedAt,
    schema: {
      id: schema.id,
      brandId: brand.id,
      slug: schema.slug,
      fieldsStyle: schema.fieldsStyle as GeneratedSchema["fieldsStyle"],
      structure: schema.structure as GeneratedSchema["structure"],
      fields: parsedFields.mappings,
      templateProfile: parsedFields.templateProfile,
      generationProfile: parsedFields.generationProfile,
      generatedArtifact: parsedFields.generatedArtifact
    } satisfies GeneratedSchema
  };
}

function parseSchemaFields(
  value: unknown,
  brandId: string
): {
  mappings: Record<string, string>;
  templateProfile: LayoutProfile;
  generationProfile: LayoutBuilderAiGenerationProfile | null;
  generatedArtifact: LayoutBuilderGeneratedBrandArtifact | null;
} {
  if (isObject(value) && isObject(value.mappings)) {
    return {
      mappings: stringRecord(value.mappings),
      templateProfile: normalizeLayoutProfile(value.templateProfile, brandId),
      generationProfile: normalizeGenerationProfile(value.generationProfile),
      generatedArtifact: normalizeGeneratedArtifact(value.generatedArtifact)
    };
  }

  return {
    mappings: stringRecord(value),
    templateProfile: createLayoutProfile(brandId),
    generationProfile: null,
    generatedArtifact: null
  };
}

function normalizeGenerationProfile(value: unknown): LayoutBuilderAiGenerationProfile | null {
  if (!isObject(value) || typeof value.provider !== "string" || typeof value.resourceAlias !== "string") {
    return null;
  }

  return value as unknown as LayoutBuilderAiGenerationProfile;
}

function normalizeGeneratedArtifact(value: unknown): LayoutBuilderGeneratedBrandArtifact | null {
  if (!isObject(value) || typeof value.artifactId !== "string" || typeof value.entryFile !== "string") {
    return null;
  }

  return value as unknown as LayoutBuilderGeneratedBrandArtifact;
}

function normalizeLayoutProfile(value: unknown, brandId: string): LayoutProfile {
  const fallback = createLayoutProfile(brandId);

  if (!isLayoutProfile(value)) {
    return fallback;
  }

  const columns = value.columns.filter((column) => PAYMENT_COLUMN_KEYS.has(column.key));

  if (columns.length === 0) {
    return fallback;
  }

  return {
    ...value,
    columns
  };
}

const PAYMENT_COLUMN_KEYS = new Set<LayoutProfile["columns"][number]["key"]>([
  "transactionId",
  "status",
  "requestedAmount",
  "paidAmount",
  "createdAt",
  "paidAt"
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringRecord(value: unknown): Record<string, string> {
  if (!isObject(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function isLayoutProfile(value: unknown): value is LayoutProfile {
  return isObject(value) && typeof value.templateId === "string" && Array.isArray(value.columns);
}

export function brandRequestToCanonicalConfig(request: BrandRequest): LayoutBuilderDashboardConfig {
  return request.canonicalPayload as unknown as LayoutBuilderDashboardConfig;
}
