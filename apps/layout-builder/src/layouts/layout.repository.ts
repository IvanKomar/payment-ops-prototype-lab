import { Inject, Injectable } from "@nestjs/common";
import type { BrandBffRequestLog, BrandGenerationDraft, BrandRequest, ContractVersion, GeneratedArtifact, Prisma } from "@prisma/client";
import type {
  LayoutBuilderBrandGenerationDraft,
  LayoutBuilderAiGenerationProfile,
  LayoutBuilderAiBrandSpec,
  LayoutBuilderContractVersion,
  LayoutBuilderContractVersionRecord,
  LayoutBuilderDashboardConfig,
  LayoutBuilderGeneratedBrandArtifact,
  LayoutBuilderPayloadStructure,
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

interface SaveGeneratedContractVersionInput {
  brandId: string;
  contractVersion: LayoutBuilderContractVersion;
  generatedArtifact: LayoutBuilderGeneratedBrandArtifact;
}

interface SaveBrandGenerationDraftInput {
  id: string;
  brandName: string;
  adminPrompt: string;
  systemPrompt: string;
  provider: string;
  model: string;
  controls: unknown;
  messages: unknown;
  spec: unknown;
  validationIssues: string[];
  status: string;
}

const BRAND_WITH_SCHEMA_INCLUDE = {
  schemas: {
    orderBy: {
      createdAt: "desc"
    },
    take: 1,
    include: {
      contractVersions: {
        where: {
          active: true
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 1,
        include: {
          artifacts: {
            where: {
              active: true
            },
            orderBy: {
              createdAt: "desc"
            },
            take: 1
          }
        }
      }
    }
  }
} satisfies Prisma.BrandInclude;

type BrandWithRelations = Prisma.BrandGetPayload<{ include: typeof BRAND_WITH_SCHEMA_INCLUDE }>;

function brandWithSchemaIncludeForSlug(slug: string): Prisma.BrandInclude {
  return {
    schemas: {
      where: { slug },
      take: 1,
      include: {
        contractVersions: {
          where: {
            active: true
          },
          orderBy: {
            createdAt: "desc"
          },
          take: 1,
          include: {
            artifacts: {
              where: {
                active: true
              },
              orderBy: {
                createdAt: "desc"
              },
              take: 1
            }
          }
        }
      }
    }
  };
}

@Injectable()
export class LayoutRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createBrand(input: CreateBrandInput): Promise<BrandWithSchema> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.brand.create({
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
                generationProfile: input.schema.generationProfile
              } as unknown as Prisma.InputJsonValue
            }
          }
        }
      });

      if (input.schema.contractVersion && input.schema.generatedArtifact) {
        await transaction.contractVersion.create({
          data: {
            id: input.schema.contractVersion.contractVersionId,
            brandId: input.schema.contractVersion.brandId,
            schemaId: input.schema.contractVersion.schemaId,
            slug: input.schema.contractVersion.slug,
            resourceAlias: input.schema.contractVersion.resourceAlias,
            payloadStructure: input.schema.contractVersion.payloadStructure,
            fieldMap: input.schema.contractVersion.fieldMap as Prisma.InputJsonValue,
          statusMap: input.schema.contractVersion.statusMap as unknown as Prisma.InputJsonValue,
          actionLabels: input.schema.contractVersion.actionLabels as unknown as Prisma.InputJsonValue,
          endpoints: input.schema.contractVersion.endpoints as Prisma.InputJsonValue,
          aiSpec: input.schema.contractVersion.aiSpec as unknown as Prisma.InputJsonValue,
          active: input.schema.contractVersion.active
          }
        });

        await transaction.generatedArtifact.create({
          data: {
            id: input.schema.generatedArtifact.artifactId,
            brandId: input.schema.generatedArtifact.brandId,
            contractVersionId: input.schema.generatedArtifact.contractVersionId,
            provider: input.schema.generatedArtifact.provider,
            model: input.schema.generatedArtifact.model,
            framework: input.schema.generatedArtifact.framework,
            entryFile: input.schema.generatedArtifact.entryFile,
            manifest: input.schema.generatedArtifact as unknown as Prisma.InputJsonValue,
            active: true
          }
        });
      }
    });

    const brand = await this.findBrand(input.schema.brandId);
    if (!brand) {
      throw new Error(`Created brand was not found: ${input.schema.brandId}`);
    }

    return brand;
  }

  async findBrand(id: string): Promise<BrandWithSchema | null> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
      include: BRAND_WITH_SCHEMA_INCLUDE
    });

    return brand ? toBrandWithSchema(brand) : null;
  }

  async findBrandBySlug(slug: string): Promise<BrandWithSchema | null> {
    const brand = await this.prisma.brand.findFirst({
      where: {
        schemas: {
          some: { slug }
        }
      },
      include: brandWithSchemaIncludeForSlug(slug)
    });

    return brand ? toBrandWithSchema(brand as unknown as BrandWithRelations) : null;
  }

  async findLatestBrands(limit: number): Promise<BrandWithSchema[]> {
    const brands = await this.prisma.brand.findMany({
      orderBy: {
        updatedAt: "desc"
      },
      take: limit,
      include: BRAND_WITH_SCHEMA_INCLUDE
    });

    return brands.map(toBrandWithSchema);
  }

  async findContractVersions(brandId: string): Promise<LayoutBuilderContractVersionRecord[]> {
    const versions = await this.prisma.contractVersion.findMany({
      where: { brandId },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        artifacts: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      }
    });

    return versions.map(contractVersionRecordToResponse);
  }

  async saveGeneratedContractVersion(input: SaveGeneratedContractVersionInput): Promise<BrandWithSchema | null> {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.contractVersion.updateMany({
        where: { brandId: input.brandId },
        data: { active: false }
      });
      await transaction.generatedArtifact.updateMany({
        where: { brandId: input.brandId },
        data: { active: false }
      });
      await transaction.contractVersion.create({
        data: {
          id: input.contractVersion.contractVersionId,
          brandId: input.contractVersion.brandId,
          schemaId: input.contractVersion.schemaId,
          slug: input.contractVersion.slug,
          resourceAlias: input.contractVersion.resourceAlias,
          payloadStructure: input.contractVersion.payloadStructure,
          fieldMap: input.contractVersion.fieldMap as Prisma.InputJsonValue,
          statusMap: input.contractVersion.statusMap as unknown as Prisma.InputJsonValue,
          actionLabels: input.contractVersion.actionLabels as unknown as Prisma.InputJsonValue,
          endpoints: input.contractVersion.endpoints as Prisma.InputJsonValue,
          aiSpec: input.contractVersion.aiSpec as unknown as Prisma.InputJsonValue,
          active: true
        }
      });
      await transaction.generatedArtifact.create({
        data: {
          id: input.generatedArtifact.artifactId,
          brandId: input.generatedArtifact.brandId,
          contractVersionId: input.generatedArtifact.contractVersionId,
          provider: input.generatedArtifact.provider,
          model: input.generatedArtifact.model,
          framework: input.generatedArtifact.framework,
          entryFile: input.generatedArtifact.entryFile,
          manifest: input.generatedArtifact as unknown as Prisma.InputJsonValue,
          active: true
        }
      });
    });

    return this.findBrand(input.brandId);
  }

  async activateContractVersion(brandId: string, contractVersionId: string): Promise<BrandWithSchema | null> {
    const existing = await this.prisma.contractVersion.findFirst({
      where: {
        id: contractVersionId,
        brandId
      }
    });

    if (!existing) {
      return null;
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.contractVersion.updateMany({
        where: { brandId },
        data: { active: false }
      });
      await transaction.generatedArtifact.updateMany({
        where: { brandId },
        data: { active: false }
      });
      await transaction.contractVersion.update({
        where: { id: contractVersionId },
        data: { active: true }
      });
      await transaction.generatedArtifact.updateMany({
        where: { contractVersionId },
        data: { active: true }
      });
    });

    return this.findBrand(brandId);
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

  async saveBrandGenerationDraft(input: SaveBrandGenerationDraftInput): Promise<LayoutBuilderBrandGenerationDraft> {
    const draft = await this.prisma.brandGenerationDraft.upsert({
      where: { id: input.id },
      create: {
        id: input.id,
        brandName: input.brandName,
        adminPrompt: input.adminPrompt,
        systemPrompt: input.systemPrompt,
        provider: input.provider,
        model: input.model,
        controls: input.controls as Prisma.InputJsonValue,
        messages: input.messages as Prisma.InputJsonValue,
        spec: input.spec as Prisma.InputJsonValue,
        validationIssues: input.validationIssues as Prisma.InputJsonValue,
        status: input.status
      },
      update: {
        adminPrompt: input.adminPrompt,
        systemPrompt: input.systemPrompt,
        provider: input.provider,
        model: input.model,
        controls: input.controls as Prisma.InputJsonValue,
        messages: input.messages as Prisma.InputJsonValue,
        spec: input.spec as Prisma.InputJsonValue,
        validationIssues: input.validationIssues as Prisma.InputJsonValue,
        status: input.status
      }
    });

    return brandGenerationDraftToResponse(draft);
  }

  async findBrandGenerationDraft(id: string): Promise<LayoutBuilderBrandGenerationDraft | null> {
    const draft = await this.prisma.brandGenerationDraft.findUnique({ where: { id } });

    return draft ? brandGenerationDraftToResponse(draft) : null;
  }

  async markBrandGenerationDraftCreated(id: string, brandId: string): Promise<void> {
    await this.prisma.brandGenerationDraft.update({
      where: { id },
      data: {
        brandId,
        status: "created"
      }
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
  const activeContractVersion = schema.contractVersions[0];

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
      contractVersion: contractVersionToResponse(activeContractVersion) ?? parsedFields.contractVersion,
      generatedArtifact: generatedArtifactToResponse(activeContractVersion?.artifacts[0]) ?? parsedFields.generatedArtifact
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
  contractVersion: LayoutBuilderContractVersion | null;
  generatedArtifact: LayoutBuilderGeneratedBrandArtifact | null;
} {
  if (isObject(value) && isObject(value.mappings)) {
    return {
      mappings: stringRecord(value.mappings),
      templateProfile: normalizeLayoutProfile(value.templateProfile, brandId),
      generationProfile: normalizeGenerationProfile(value.generationProfile),
      contractVersion: normalizeContractVersion(value.contractVersion),
      generatedArtifact: normalizeGeneratedArtifact(value.generatedArtifact)
    };
  }

  return {
    mappings: stringRecord(value),
    templateProfile: createLayoutProfile(brandId),
    generationProfile: null,
    contractVersion: null,
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

function normalizeContractVersion(value: unknown): LayoutBuilderContractVersion | null {
  if (!isObject(value) || typeof value.contractVersionId !== "string" || typeof value.resourceAlias !== "string") {
    return null;
  }

  return value as unknown as LayoutBuilderContractVersion;
}

function contractVersionToResponse(
  value: (ContractVersion & { artifacts: GeneratedArtifact[] }) | undefined
): LayoutBuilderContractVersion | null {
  if (!value) {
    return null;
  }

  return {
    contractVersionId: value.id,
    brandId: value.brandId,
    schemaId: value.schemaId,
    slug: value.slug,
    resourceAlias: value.resourceAlias,
    payloadStructure: value.payloadStructure as LayoutBuilderPayloadStructure,
    fieldMap: stringRecord(value.fieldMap),
    statusMap: value.statusMap as unknown as LayoutBuilderContractVersion["statusMap"],
    actionLabels: value.actionLabels as unknown as LayoutBuilderContractVersion["actionLabels"],
    endpoints: stringRecord(value.endpoints),
    ...(isObject(value.aiSpec) ? { aiSpec: value.aiSpec as unknown as LayoutBuilderAiBrandSpec } : {}),
    active: value.active,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString()
  };
}

function contractVersionRecordToResponse(
  value: ContractVersion & { artifacts: GeneratedArtifact[] }
): LayoutBuilderContractVersionRecord {
  const contractVersion = contractVersionToResponse(value);

  if (!contractVersion) {
    throw new Error(`Unable to normalize contract version: ${value.id}`);
  }

  return {
    contractVersion,
    generatedArtifact: generatedArtifactToResponse(value.artifacts[0])
  };
}

function generatedArtifactToResponse(value: GeneratedArtifact | undefined): LayoutBuilderGeneratedBrandArtifact | null {
  if (!value) {
    return null;
  }

  return normalizeGeneratedArtifact(value.manifest);
}

function brandGenerationDraftToResponse(value: BrandGenerationDraft): LayoutBuilderBrandGenerationDraft {
  const validationIssues = Array.isArray(value.validationIssues)
    ? value.validationIssues.filter((entry): entry is string => typeof entry === "string")
    : [];

  return {
    draftId: value.id,
    brandName: value.brandName,
    adminPrompt: value.adminPrompt,
    systemPrompt: value.systemPrompt,
    provider: value.provider as LayoutBuilderBrandGenerationDraft["provider"],
    model: value.model,
    controls: value.controls as unknown as LayoutBuilderBrandGenerationDraft["controls"],
    messages: Array.isArray(value.messages) ? (value.messages as unknown as LayoutBuilderBrandGenerationDraft["messages"]) : [],
    spec: isObject(value.spec) ? (value.spec as unknown as LayoutBuilderBrandGenerationDraft["spec"]) : null,
    validationIssues,
    status: value.status as LayoutBuilderBrandGenerationDraft["status"],
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString()
  };
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
