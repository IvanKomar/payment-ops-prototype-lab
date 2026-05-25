import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import {
  entitySlugSchema,
  parseBearerToken,
  slugSchema,
  ZodValidationPipe
} from "../dto/layout.schemas.js";
import { LayoutService } from "../layout.service.js";

@ApiTags("public-brand-api")
@Controller(":slug")
export class PublicBrandApiController {
  constructor(@Inject(LayoutService) private readonly layoutService: LayoutService) {}

  @Get("_runtime")
  @ApiOkResponse({ description: "Server-side runtime bootstrap payload" })
  @ApiNotFoundResponse({ description: "Brand slug was not found" })
  getRuntimeBootstrap(
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<unknown> {
    return this.layoutService.getPublicBrandProfile(slug);
  }

  @Get(":entity")
  @ApiOkResponse({ description: "Current merchant runtime entity" })
  @ApiNotFoundResponse({ description: "Brand slug was not found" })
  getEntity(
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Param("entity", new ZodValidationPipe<string>(entitySlugSchema)) entity: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<unknown> {
    return this.layoutService.getPublicRuntimeEntity(slug, entity, authorization);
  }

  @Post(":entity")
  @ApiOkResponse({ description: "Create or authenticate against a merchant runtime entity" })
  @ApiNotFoundResponse({ description: "Brand slug was not found" })
  postEntity(
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Param("entity", new ZodValidationPipe<string>(entitySlugSchema)) entity: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() payload: unknown
  ): Promise<unknown> {
    return this.layoutService.postPublicRuntimeEntity(slug, entity, authorization, payload);
  }
}
