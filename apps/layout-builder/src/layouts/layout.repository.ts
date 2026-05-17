import { Inject, Injectable } from "@nestjs/common";
import type { Brand, BrandRequest, BrandSchema, Prisma } from "@prisma/client";
import type { LayoutBuilderDashboardConfig, LayoutBuilderPalette } from "@payment-ops/shared-types";

import { PrismaService } from "../prisma/prisma.service.js";
import type {
  BrandWithSchema,
  CreateBrandInput,
  GeneratedSchema,
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
            fields: input.schema.fields as Prisma.InputJsonValue
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
      fields: schema.fields as Record<string, string>
    } satisfies GeneratedSchema
  };
}

export function brandRequestToCanonicalConfig(request: BrandRequest): LayoutBuilderDashboardConfig {
  return request.canonicalPayload as unknown as LayoutBuilderDashboardConfig;
}
