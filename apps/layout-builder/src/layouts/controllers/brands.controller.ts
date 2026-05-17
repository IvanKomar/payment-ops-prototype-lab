import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
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
  LayoutBuilderConfigureResponse,
  LayoutBuilderDeleteBrandResponse
} from "@payment-ops/shared-types";

import { loadLayoutBuilderConfig } from "../../config/layout-builder.config.js";
import {
  brandIdSchema,
  BrandListItemDto,
  BrandResponseDto,
  ConfigureBrandResponseDto,
  createBrandSchema,
  CreateBrandResponseDto,
  DeleteBrandResponseDto,
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
        }
      }
    }
  })
  @ApiOkResponse({ type: BrandResponseDto })
  createBrand(
    @UploadedFile() file: UploadedLogoFile | undefined,
    @Body(new ZodValidationPipe(createBrandSchema)) body: { brandName: string }
  ): Promise<LayoutBuilderBrandResponse> {
    return this.layoutService.createBrand(file, body);
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

  @Delete(":id")
  @ApiOkResponse({ type: DeleteBrandResponseDto })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  deleteBrand(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string
  ): Promise<LayoutBuilderDeleteBrandResponse> {
    return this.layoutService.deleteBrand(id);
  }

  @Get(":id/layout")
  @Header("Content-Type", "image/svg+xml; charset=utf-8")
  @ApiOkResponse({ description: "Rendered SVG layout" })
  @ApiNotFoundResponse({ description: "Brand was not found" })
  renderLayout(@Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string): Promise<string> {
    return this.layoutService.renderBrandLayout(id);
  }

  @Get(":id/:slug")
  @ApiOkResponse({ description: "Latest dashboard data in the generated brand API contract" })
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
