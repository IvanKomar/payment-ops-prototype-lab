import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { PaymentCoreCreatePaymentResponse, PaymentCoreHistoryResponse } from "@payment-ops/shared-types";

import {
  createPaymentSchema,
  parseBearerToken,
  paymentIdSchema,
  ZodValidationPipe,
  type CreatePaymentInput
} from "./dto/payment.schemas.js";
import { PaymentsService } from "./payments.service.js";

@ApiTags("payments")
@Controller("payments")
export class PaymentsController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get("history")
  @ApiOkResponse({ description: "Payment history for the authenticated brand account" })
  history(@Headers("authorization") authorization: string | undefined): Promise<PaymentCoreHistoryResponse> {
    return this.paymentsService.history(parseBearerToken(authorization));
  }

  @Post()
  @ApiOkResponse({ description: "Create a simulated local payment" })
  createPayment(
    @Headers("authorization") authorization: string | undefined,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentInput
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.paymentsService.createPayment(parseBearerToken(authorization), body);
  }

  @Post(":id/confirm")
  @ApiOkResponse({ description: "Move a payment into processing" })
  confirm(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", new ZodValidationPipe(paymentIdSchema)) paymentId: string
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.paymentsService.transitionPayment(parseBearerToken(authorization), paymentId, "processing", "user_confirmed");
  }

  @Post(":id/capture")
  @ApiOkResponse({ description: "Capture an authorized or processing payment" })
  capture(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", new ZodValidationPipe(paymentIdSchema)) paymentId: string
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.paymentsService.transitionPayment(parseBearerToken(authorization), paymentId, "captured", "user_captured");
  }

  @Post(":id/settle")
  @ApiOkResponse({ description: "Settle a captured or processing payment" })
  settle(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", new ZodValidationPipe(paymentIdSchema)) paymentId: string
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.paymentsService.transitionPayment(parseBearerToken(authorization), paymentId, "settled", "user_settled");
  }

  @Post(":id/refund")
  @ApiOkResponse({ description: "Refund an authorized, captured, or settled payment" })
  refund(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", new ZodValidationPipe(paymentIdSchema)) paymentId: string
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.paymentsService.transitionPayment(parseBearerToken(authorization), paymentId, "refunded", "user_refunded");
  }

  @Post(":id/cancel")
  @ApiOkResponse({ description: "Cancel a payment before capture" })
  cancel(
    @Headers("authorization") authorization: string | undefined,
    @Param("id", new ZodValidationPipe(paymentIdSchema)) paymentId: string
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.paymentsService.transitionPayment(parseBearerToken(authorization), paymentId, "canceled", "user_canceled");
  }
}
