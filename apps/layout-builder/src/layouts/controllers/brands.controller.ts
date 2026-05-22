import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Inject,
  Param,
  Post,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiBody,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";
import type {
  LayoutBuilderBrandListItem,
  LayoutBuilderBrandResponse,
  LayoutBuilderBrandSchemaResponse,
  LayoutBuilderContractVersionRecord,
  LayoutBuilderConfigureResponse,
  LayoutBuilderDeleteBrandResponse,
  LayoutBuilderRegenerateContractRequest
} from "@payment-ops/shared-types";

import { loadLayoutBuilderConfig } from "../../config/layout-builder.config.js";
import {
  brandIdSchema,
  BrandListItemDto,
  BrandResponseDto,
  ConfigureBrandResponseDto,
  contractVersionIdSchema,
  createBrandSchema,
  CreateBrandResponseDto,
  DeleteBrandResponseDto,
  parseOptionalBearerToken,
  regenerateContractSchema,
  slugSchema,
  ZodValidationPipe
} from "../dto/layout.schemas.js";
import { LayoutService } from "../layout.service.js";
import type { UploadedLogoFile } from "../layout.types.js";

const config = loadLayoutBuilderConfig();

@ApiTags("brands")
@Controller("brands")
export class BrandsController {
  constructor(@Inject(LayoutService) private readonly layoutService: LayoutService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["logo", "brandName"],
      properties: {
        logo: {
          type: "string",
          format: "binary"
        },
        brandName: {
          type: "string",
          example: "KOI"
        },
        aiPrompt: {
          type: "string",
          example: "Create a premium merchant dashboard with settlement-oriented wording"
        },
        systemPrompt: {
          type: "string",
          example: "Generate a brand runtime contract that integrates with the public payment facade"
        }
      }
    }
  })
  @ApiOkResponse({ type: BrandResponseDto })
  createBrand(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body(new ZodValidationPipe(createBrandSchema)) body: { brandName: string },
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrand(file, body, parseOptionalBearerToken(authorization));
  }

  @Post("ai")
  @UseInterceptors(
    FileInterceptor("logo", {
      limits: {
        fileSize: config.LAYOUT_MAX_UPLOAD_BYTES
      }
    })
  )
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      required: ["logo", "brandName", "aiPrompt"],
      properties: {
        logo: {
          type: "string",
          format: "binary"
        },
        brandName: {
          type: "string",
          example: "Nova Ledger"
        },
        aiPrompt: {
          type: "string",
          example: "Create a risk-review payment portal for enterprise merchants"
        },
        systemPrompt: {
          type: "string",
          example: "Generate a brand runtime contract that maps to Payment Core without exposing internals"
        }
      }
    }
  })
  @ApiOkResponse({ type: BrandResponseDto })
  createAiBrand(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body(new ZodValidationPipe(createBrandSchema)) body: { brandName: string; aiPrompt?: string; systemPrompt?: string },
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrand(file, body, parseOptionalBearerToken(authorization));
  }

  @Get("recent")
  @ApiOkResponse({ type: BrandListItemDto, isArray: true })
  listRecentBrands(): Promise<LayoutBuilderBrandListItem[]> {
    return this.layoutService.listRecentBrands();
  }

  @Get(":id/schema")
  @ApiOkResponse({ type: CreateBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  getSchema(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    return this.layoutService.getBrandSchema(id);
  }

  @Get(":id/contract-versions")
  @ApiOkResponse({ description: "Generated contract versions for the selected brand" })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  listContractVersions(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderContractVersionRecord[]> {
    return this.layoutService.listContractVersions(id, parseOptionalBearerToken(authorization));
  }

  @Post(":id/contract-versions/regenerate")
  @ApiOkResponse({ type: CreateBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  regenerateContractVersion(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Body(new ZodValidationPipe(regenerateContractSchema)) body: LayoutBuilderRegenerateContractRequest,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    return this.layoutService.regenerateContractVersion(id, body, parseOptionalBearerToken(authorization));
  }

  @Post(":id/contract-versions/:contractVersionId/activate")
  @ApiOkResponse({ type: CreateBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand or contract version was not found" })
  activateContractVersion(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("contractVersionId", new ZodValidationPipe<string>(contractVersionIdSchema)) contractVersionId: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandSchemaResponse> {
    return this.layoutService.activateContractVersion(id, contractVersionId, parseOptionalBearerToken(authorization));
  }

  @Delete(":id")
  @ApiOkResponse({ type: DeleteBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  deleteBrand(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderDeleteBrandResponse> {
    return this.layoutService.deleteBrand(id, parseOptionalBearerToken(authorization));
  }

  @Get(":id/layout")
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  @ApiOkResponse({ description: "Rendered SVG layout" })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  renderLayout(@Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string): Promise<string> {
    return this.layoutService.renderBrandLayout(id);
  }

  @Get(":id/:slug/app")
  @Header("Content-Type", "text/html; charset=utf-8")
  @ApiOkResponse({ description: "Server-rendered brand preview application" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  renderBrandApp(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<string> {
    return this.layoutService.renderBrandApp(id, slug);
  }

  @Get(":id/:slug/generated/preview")
  @Header("Content-Type", "text/html; charset=utf-8")
  @ApiOkResponse({ description: "Generated brand artifact preview application" })
  @ApiNotFoundResponse({ description: "Brand, schema endpoint, or generated artifact was not found" })
  renderGeneratedPreview(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<string> {
    return this.layoutService.renderGeneratedArtifactPreview(id, slug);
  }

  @Get(":id/:slug/data")
  @ApiOkResponse({ description: "Latest dashboard data for the public brand app" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  getBrandAppData(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<unknown> {
    return this.layoutService.getBrandContractData(id, slug);
  }

  @Get(":id/:slug")
  @ApiOkResponse({ description: "Latest dashboard data for the generated brand endpoint" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  getBrandContractData(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<unknown> {
    return this.layoutService.getBrandContractData(id, slug);
  }

  @Post(":id/:slug")
  @ApiOkResponse({ type: ConfigureBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  configureBrand(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Body() payload: unknown
  ): Promise<LayoutBuilderConfigureResponse> {
    return this.layoutService.configureBrand(id, slug, payload);
  }
}
