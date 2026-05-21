import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import type {
  PaymentCoreAuthResponse,
  PaymentCoreCreatePaymentRequest,
  PaymentCoreCreatePaymentResponse,
  PaymentCoreHistoryResponse
} from "@payment-ops/shared-types";

import type { LayoutBuilderEnv } from "../../config/env.schema.js";
import { LAYOUT_BUILDER_CONFIG } from "../layout.constants.js";

interface PaymentCoreRegisterInput {
  brandId: string;
  email: string;
  password: string;
  displayName?: string;
  currency?: string;
}

interface PaymentCoreLoginInput {
  brandId: string;
  email: string;
  password: string;
}

@Injectable()
export class PaymentCoreClientService {
  constructor(@Inject(LAYOUT_BUILDER_CONFIG) private readonly config: LayoutBuilderEnv) {}

  register(input: PaymentCoreRegisterInput): Promise<PaymentCoreAuthResponse> {
    return this.request("/auth/register", {
      method: "POST",
      body: input
    });
  }

  login(input: PaymentCoreLoginInput): Promise<PaymentCoreAuthResponse> {
    return this.request("/auth/login", {
      method: "POST",
      body: input
    });
  }

  history(sessionToken: string): Promise<PaymentCoreHistoryResponse> {
    return this.request("/payments/history", {
      method: "GET",
      sessionToken
    });
  }

  createPayment(
    sessionToken: string,
    input: PaymentCoreCreatePaymentRequest
  ): Promise<PaymentCoreCreatePaymentResponse> {
    return this.request("/payments", {
      method: "POST",
      sessionToken,
      body: input
    });
  }

  private async request<T>(
    path: string,
    init: {
      method: "GET" | "POST";
      body?: unknown;
      sessionToken?: string;
    }
  ): Promise<T> {
    const requestInit: RequestInit = {
      method: init.method,
      headers: {
        accept: "application/json",
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.sessionToken ? { authorization: `Bearer ${init.sessionToken}` } : {})
      }
    };

    if (init.body) {
      requestInit.body = JSON.stringify(init.body);
    }

    const response = await fetch(new URL(path, this.config.PAYMENT_CORE_BASE_URL), {
      ...requestInit
    });

    if (!response.ok) {
      const details = await response.text();
      throw new BadGatewayException({
        message: "Payment Core request failed",
        status: response.status,
        details
      });
    }

    return (await response.json()) as T;
  }
}
