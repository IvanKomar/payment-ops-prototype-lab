import { Controller, Get, Headers, Inject } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  PaymentCoreBalanceTransactionsResponse,
  PaymentCoreCustomersResponse,
  PaymentCorePaymentIntentsResponse,
  PaymentCorePaymentMethodsResponse
} from "@payment-ops/shared-types";

import { parseBearerToken } from "./dto/payment.schemas.js";
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

  @Get("payment-methods")
  @ApiOkResponse({ description: "Payment methods for the authenticated merchant account" })
  paymentMethods(
    @Headers("authorization") authorization: string | undefined
  ): Promise<PaymentCorePaymentMethodsResponse> {
    return this.paymentsService.paymentMethods(parseBearerToken(authorization));
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
}
