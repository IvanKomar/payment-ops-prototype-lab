import { Body, Controller, Get, Headers, Inject, Param, Post } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  PaymentCoreBalanceTransactionsResponse,
  PaymentCoreBrandResourcesResponse,
  PaymentCoreCreateCustomerResponse,
  PaymentCoreCreatePaymentMethodResponse,
  PaymentCoreCustomersResponse,
  PaymentCorePaymentIntentsResponse,
  PaymentCorePaymentMethodsResponse,
  PaymentCoreSeedBrandDemoResponse
} from "@payment-ops/shared-types";

import {
  createCustomerSchema,
  createPaymentMethodSchema,
  parseBearerToken,
  ZodValidationPipe,
  type CreateCustomerInput,
  type CreatePaymentMethodInput
} from "./dto/payment.schemas.js";
import { PaymentsService } from "./payments.service.js";

@ApiTags("gateway-resources")
@Controller()
export class GatewayResourcesController {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  @Get("customers")
  @ApiOkResponse({ description: "Customers for the authenticated merchant account" })
  customers(@Headers("authorization") authorization: string | undefined): Promise<PaymentCoreCustomersResponse> {
    return this.paymentsService.customers(parseBearerToken(authorization));
  }

  @Post("customers")
  @ApiOkResponse({ description: "Create or update a saved customer for the authenticated merchant account" })
  createCustomer(
    @Headers("authorization") authorization: string | undefined,
    @Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput
  ): Promise<PaymentCoreCreateCustomerResponse> {
    return this.paymentsService.createCustomer(parseBearerToken(authorization), body);
  }

  @Get("payment-methods")
  @ApiOkResponse({ description: "Payment methods for the authenticated merchant account" })
  paymentMethods(
    @Headers("authorization") authorization: string | undefined
  ): Promise<PaymentCorePaymentMethodsResponse> {
    return this.paymentsService.paymentMethods(parseBearerToken(authorization));
  }

  @Post("payment-methods")
  @ApiOkResponse({ description: "Create a saved payment method for the authenticated merchant account" })
  createPaymentMethod(
    @Headers("authorization") authorization: string | undefined,
    @Body(new ZodValidationPipe(createPaymentMethodSchema)) body: CreatePaymentMethodInput
  ): Promise<PaymentCoreCreatePaymentMethodResponse> {
    return this.paymentsService.createPaymentMethod(parseBearerToken(authorization), body);
  }

  @Get("payment-intents")
  @ApiOkResponse({ description: "Payment intents for the authenticated merchant account" })
  paymentIntents(
    @Headers("authorization") authorization: string | undefined
  ): Promise<PaymentCorePaymentIntentsResponse> {
    return this.paymentsService.paymentIntents(parseBearerToken(authorization));
  }

  @Get("balance-transactions")
  @ApiOkResponse({ description: "Balance movements for the authenticated merchant account" })
  balanceTransactions(
    @Headers("authorization") authorization: string | undefined
  ): Promise<PaymentCoreBalanceTransactionsResponse> {
    return this.paymentsService.balanceTransactions(parseBearerToken(authorization));
  }

  @Get("admin/brands/:brandId/resources")
  @ApiOkResponse({ description: "Prototype admin resource snapshot for a brand" })
  brandResources(@Param("brandId") brandId: string): Promise<PaymentCoreBrandResourcesResponse> {
    return this.paymentsService.brandResources(brandId);
  }

  @Post("admin/brands/:brandId/seed")
  @ApiOkResponse({ description: "Create prototype demo data for a brand" })
  seedBrandDemoData(@Param("brandId") brandId: string): Promise<PaymentCoreSeedBrandDemoResponse> {
    return this.paymentsService.seedBrandDemoData(brandId);
  }

  @Post("admin/brands/:brandId/reset-demo")
  @ApiOkResponse({ description: "Remove prototype demo data for a brand" })
  resetBrandDemoData(@Param("brandId") brandId: string): Promise<PaymentCoreBrandResourcesResponse> {
    return this.paymentsService.resetBrandDemoData(brandId);
  }
}
