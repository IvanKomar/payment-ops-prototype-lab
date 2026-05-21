import { Body, Controller, Get, Headers, Inject, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { PaymentCoreAuthResponse } from "@payment-ops/shared-types";

import {
  loginSchema,
  parseBearerToken,
  registerSchema,
  ZodValidationPipe,
  type LoginInput,
  type RegisterInput
} from "./dto/payment.schemas.js";
import { PaymentsService } from "./payments.service.js";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Post("register")
  @ApiOkResponse({ description: "Registered payment-core user and session" })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput
  ): Promise<PaymentCoreAuthResponse> {
    return this.paymentsService.register(body);
  }

  @Post("login")
  @ApiOkResponse({ description: "Payment-core user session" })
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<PaymentCoreAuthResponse> {
    return this.paymentsService.login(body);
  }

  @Get("me")
  @ApiOkResponse({ description: "Current payment-core user session" })
  me(@Headers("authorization") authorization: string | undefined): Promise<PaymentCoreAuthResponse> {
    return this.paymentsService.me(parseBearerToken(authorization));
  }
}
