import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import {
  brandIdSchema,
  slugSchema,
  ZodValidationPipe
} from "../dto/layout.schemas.js";
import { LayoutService } from "../layout.service.js";

@ApiTags("brand-bff")
@Controller("brands/:id/:slug/bff")
export class BrandBffController {
  constructor(@Inject(LayoutService) private readonly layoutService: LayoutService) {}

  @Get(":alias")
  @ApiOkResponse({ description: "Brand-specific BFF read endpoint alias" })
  @ApiNotFoundResponse({ description: "Brand, schema, or endpoint alias was not found" })
  getAlias(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Param("alias", new ZodValidationPipe<string>(slugSchema)) alias: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<unknown> {
    return this.layoutService.dispatchRuntimeGateway(id, slug, "GET", alias, authorization);
  }

  @Post(":alias")
  @ApiOkResponse({ description: "Brand-specific BFF write endpoint alias" })
  @ApiNotFoundResponse({ description: "Brand, schema, or endpoint alias was not found" })
  postAlias(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Param("alias", new ZodValidationPipe<string>(slugSchema)) alias: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() payload: unknown
  ): Promise<unknown> {
    return this.layoutService.dispatchRuntimeGateway(id, slug, "POST", alias, authorization, payload);
  }
}
