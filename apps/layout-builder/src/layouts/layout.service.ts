import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderConfigureResponse,
  LayoutBuilderDeleteBrandResponse
} from "@payment-ops/shared-types";
import { randomUUID } from "node:crypto";

import type { LayoutBuilderEnv } from "../config/env.schema.js";
import { ACCEPTED_LOGO_MIME_TYPES, LAYOUT_BUILDER_CONFIG } from "./layout.constants.js";
import { createDefaultDashboardConfig } from "./default-dashboard.js";
import { LogoStorageService } from "./logo/logo-storage.service.js";
import { PaletteService } from "./palette/palette.service.js";
import { brandRequestToCanonicalConfig, LayoutRepository } from "./layout.repository.js";
import type { BrandWithSchema, UploadedLogoFile } from "./layout.types.js";
import { SchemaGeneratorService } from "./schema/schema-generator.service.js";
import { PayloadMapperService } from "./schema/payload-mapper.service.js";
import { SvgRendererService } from "./render/svg-renderer.service.js";
import { createLayoutProfile } from "./render/layout-profile.js";

@Injectable()
export class LayoutService {
  constructor(
    @Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv,
    @Inject(LayoutRepository) private readonly repository: LayoutRepository,
    @Inject(LogoStorageService) private readonly logoStorage: LogoStorageService,
    @Inject(PaletteService) private readonly paletteService: PaletteService,
    @Inject(SchemaGeneratorService) private readonly schemaGenerator: SchemaGeneratorService,
    @Inject(PayloadMapperService) private readonly payloadMapper: PayloadMapperService,
    @Inject(SvgRendererService) private readonly renderer: SvgRendererService
  ) {}

  async createBrand(
    file: UploadedLogoFile | undefined,
    body: { brandName: string }
  ): Promise<LayoutBuilderBrandResponse> {
    this.assertLogo(file);

    const brandId = `br_${randomUUID().replaceAll("-", "")}`;
    const logo = await this.logoStorage.store(file);
    const palette = await this.paletteService.extract(logo);
    const schema = this.schemaGenerator.generate(brandId, body.brandName);
    const brand = await this.repository.createBrand({
      name: body.brandName,
      logo,
      palette,
      schema
    });

    return this.toBrandResponse(brand);
  }

  async listRecentBrands(): Promise<LayoutBuilderBrandListItem[]> {
    const brands = await this.repository.findLatestBrands(20);
    return brands.map((brand) => ({
      brandId: brand.id,
      name: brand.name,
      logoMimeType: brand.logoMimeType,
      palette: brand.palette,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString()
    }));
  }

  async deleteBrand(id: string): Promise<LayoutBuilderDeleteBrandResponse> {
    const brand = await this.getExistingBrand(id);
    await this.repository.deleteBrand(id);
    await this.logoStorage.remove(brand.logoPath).catch(() => undefined);

    return {
      brandId: id,
      deleted: true
    };
  }

  async getBrandSchema(id: string): Promise<LayoutBuilderBrandSchemaResponse> {
    const brand = await this.getExistingBrand(id);
    return this.toSchemaResponse(brand);
  }

  async configureBrand(id: string, slug: string, payload: unknown): Promise<LayoutBuilderConfigureResponse> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    const canonicalPayload = this.payloadMapper.toCanonical(brand.schema, payload);
    const renderedSvg = await this.renderer.render({ brand, config: canonicalPayload });
    const request = await this.repository.saveBrandRequest({
      id: `req_${randomUUID().replaceAll("-", "")}`,
      brandId: brand.id,
      schemaId: brand.schema.id,
      originalPayload: payload,
      canonicalPayload,
      renderedSvg
    });

    return {
      requestId: request.id,
      brandId: brand.id,
      layoutUrl: `/brands/${brand.id}/layout`,
      data: this.payloadMapper.toExternal(brand.schema, canonicalPayload)
    };
  }

  async getBrandContractData(id: string, slug: string): Promise<unknown> {
    const brand = await this.getExistingBrand(id);
    this.assertBrandApiSlug(brand, slug);

    const latestRequest = await this.repository.findLatestRequest(id);
    const config = latestRequest
      ? brandRequestToCanonicalConfig(latestRequest)
      : createDefaultDashboardConfig(brand.name);

    return this.payloadMapper.toExternal(brand.schema, config);
  }

  async renderBrandLayout(id: string): Promise<string> {
    const brand = await this.getExistingBrand(id);
    const latestRequest = await this.repository.findLatestRequest(id);
    const config = latestRequest
      ? brandRequestToCanonicalConfig(latestRequest)
      : createDefaultDashboardConfig(brand.name);

    return latestRequest?.renderedSvg ?? this.renderer.render({ brand, config });
  }

  private async getExistingBrand(id: string): Promise<BrandWithSchema> {
    const brand = await this.repository.findBrand(id);

    if (!brand) {
      throw new NotFoundException(`Brand was not found: ${id}`);
    }

    return brand;
  }

  private assertBrandApiSlug(brand: BrandWithSchema, slug: string): void {
    if (brand.schema.slug !== slug) {
      throw new NotFoundException(`Brand schema endpoint was not found: ${brand.id}/${slug}`);
    }
  }

  private assertLogo(file: UploadedLogoFile | undefined): asserts file is UploadedLogoFile {
    if (!file) {
      throw new BadRequestException("Logo file is required");
    }

    if (!ACCEPTED_LOGO_MIME_TYPES.includes(file.mimetype as (typeof ACCEPTED_LOGO_MIME_TYPES)[number])) {
      throw new BadRequestException(`Unsupported logo MIME type: ${file.mimetype}`);
    }

    if (file.size > this.config.LAYOUT_MAX_UPLOAD_BYTES) {
      throw new BadRequestException("Logo file is too large");
    }
  }

  private toBrandResponse(brand: BrandWithSchema): LayoutBuilderBrandResponse {
    return {
      ...this.toSchemaResponse(brand),
      name: brand.name,
      logoMimeType: brand.logoMimeType,
      palette: brand.palette,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString()
    };
  }

  private toSchemaResponse(brand: BrandWithSchema): LayoutBuilderBrandSchemaResponse {
    return {
      brandId: brand.id,
      schemaId: brand.schema.id,
      endpoint: `/brands/${brand.id}/${brand.schema.slug}`,
      method: "POST",
      methods: ["GET", "POST"],
      fieldsStyle: brand.schema.fieldsStyle,
      structure: brand.schema.structure,
      layoutVariant: createLayoutProfile(brand.id).variant,
      fields: brand.schema.fields,
      samplePayload: this.schemaGenerator.samplePayload(brand.schema, brand.name)
    };
  }
}
