import { Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  LayoutBuilderAdminAuthResponse,
  LayoutBuilderBrandMembership
} from "@payment-ops/shared-types";

import { AuthBoundaryService } from "../auth/auth-boundary.service.js";
import {
  brandIdSchema,
  parseOptionalBearerToken,
  ZodValidationPipe
} from "../dto/layout.schemas.js";

@ApiTags("admin-auth")
@Controller("admin")
export class AdminAuthController {
  constructor(@Inject(AuthBoundaryService) private readonly authBoundary: AuthBoundaryService) {}

  @Post("auth/dev-session")
  @ApiOkResponse({ description: "Local prototype admin session" })
  createDevSession(): Promise<LayoutBuilderAdminAuthResponse> {
    return this.authBoundary.createDevAdminSession();
  }

  @Get("auth/me")
  @ApiOkResponse({ description: "Current admin session with local fallback" })
  me(@Headers("authorization") authorization: string | undefined): Promise<LayoutBuilderAdminAuthResponse> {
    return this.authBoundary.resolveAdminSession(parseOptionalBearerToken(authorization));
  }

  @Get("brands/:id/memberships")
  @ApiOkResponse({ description: "Brand memberships across the shared auth boundary" })
  async memberships(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string,
    @Headers("authorization") authorization: string | undefined
  ): Promise<LayoutBuilderBrandMembership[]> {
    await this.authBoundary.resolveAdminSession(parseOptionalBearerToken(authorization));
    return this.authBoundary.listBrandMemberships(id);
  }
}
