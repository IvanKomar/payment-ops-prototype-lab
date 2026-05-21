import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiNotFoundResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";

import {
  brandIdSchema,
  parseBearerToken,
  slugSchema,
  ZodValidationPipe
} from "../dto/layout.schemas.js";
import { LayoutService } from "../layout.service.js";

@ApiTags("brand-runtime")
@Controller("brands/:id/:slug/runtime")
export class BrandRuntimeController {
  constructor(@Inject(LayoutService) private readonly layoutService: LayoutService) {}

  @Get("config")
  @ApiOkResponse({ description: "Brand-specific runtime contract" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  getConfig(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string
  ): Promise<unknown> {
    return this.layoutService.getBrandRuntimeConfig(id, slug);
  }

  @Post("register")
  @ApiOkResponse({ description: "Register a user in this brand runtime" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  register(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Body() payload: unknown
  ): Promise<unknown> {
    return this.layoutService.registerRuntimeUser(id, slug, payload);
  }

  @Post("login")
  @ApiOkResponse({ description: "Login a user in this brand runtime" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  login(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Body() payload: unknown
  ): Promise<unknown> {
    return this.layoutService.loginRuntimeUser(id, slug, payload);
  }

  @Get("payments")
  @ApiOkResponse({ description: "Brand-specific payment history" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  getPayments(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<unknown> {
    return this.layoutService.getRuntimePayments(id, slug, parseBearerToken(authorization));
  }

  @Post("payments")
  @ApiOkResponse({ description: "Create a brand-specific payment" })
  @ApiNotFoundResponse({ description: "Brand or schema endpoint was not found" })
  createPayment(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Param("slug", new ZodValidationPipe<string>(slugSchema)) slug: string,
    @Headers("authorization") authorization: string | undefined,
    @Body() payload: unknown
  ): Promise<unknown> {
    return this.layoutService.createRuntimePayment(id, slug, parseBearerToken(authorization), payload);
  }
}
