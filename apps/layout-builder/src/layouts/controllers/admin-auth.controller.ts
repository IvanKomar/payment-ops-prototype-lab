import { Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  LayoutBuilderAdminAuthResponse,
  LayoutBuilderBrandMembership
} from "@payment-ops/shared-types";

import { AuthBoundaryService } from "../auth/auth-boundary.service.js";
import {
  brandIdSchema,
  parseBearerToken,
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
    return this.authBoundary.resolveAdminSession(optionalBearerToken(authorization));
  }

  @Get("brands/:id/memberships")
  @ApiOkResponse({ description: "Brand memberships across the shared auth boundary" })
  memberships(
    @Param("id", new ZodValidationPipe<string>(brandIdSchema)) id: string
  ): Promise<LayoutBuilderBrandMembership[]> {
    return this.authBoundary.listBrandMemberships(id);
  }
}

function optionalBearerToken(value: string | undefined): string | undefined {
  return value ? parseBearerToken(value) : undefined;
}
