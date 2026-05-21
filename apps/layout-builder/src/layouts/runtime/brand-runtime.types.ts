import type {
  LayoutBuilderAiGenerationProfile,
  PaymentCoreAccount,
  PaymentCoreMethodType,
  PaymentCoreAuthResponse,
  PaymentCoreCreatePaymentRequest,
  PaymentCoreHistoryResponse,
  PaymentCorePayment,
  PaymentCoreStatus,
  PaymentCoreUser
} from "@payment-ops/shared-types";
import { createHash } from "node:crypto";

import type { BrandWithSchema } from "../layout.types.js";

export interface BrandRuntimeContract {
  brandId: string;
  brandName: string;
  resourceAlias: string;
  statusMap: Record<PaymentCoreStatus, string>;
  actionLabels: NonNullable<LayoutBuilderAiGenerationProfile["actionLabels"]>;
  fields: {
    paymentId: string;
    externalReference: string;
    status: string;
    amount: string;
    currency: string;
    destinationLabel: string;
    methodType: string;
    createdAt: string;
  };
  accountFields: {
    accountId: string;
    balance: string;
    currency: string;
  };
  userFields: {
    userId: string;
    email: string;
    displayName: string;
  };
  endpoints: {
    register: string;
    login: string;
    payments: string;
    config: string;
  };
}

export function createBrandRuntimeContract(brand: BrandWithSchema): BrandRuntimeContract {
  const generation = brand.schema.generationProfile;
  const resourceAlias = generation?.resourceAlias ?? "payments";

  return {
    brandId: brand.id,
    brandName: brand.name,
    resourceAlias,
    statusMap: generation?.statusMap ?? DEFAULT_STATUS_MAP,
    actionLabels: generation?.actionLabels ?? DEFAULT_ACTION_LABELS,
    fields: {
      paymentId: runtimeField(brand, "paymentId"),
      externalReference: runtimeField(brand, "externalReference"),
      status: runtimeField(brand, "status"),
      amount: runtimeField(brand, "amount"),
      currency: runtimeField(brand, "currency"),
      destinationLabel: runtimeField(brand, "destinationLabel"),
      methodType: runtimeField(brand, "methodType"),
      createdAt: runtimeField(brand, "createdAt")
    },
    accountFields: {
      accountId: runtimeField(brand, "accountId"),
      balance: runtimeField(brand, "balance"),
      currency: runtimeField(brand, "accountCurrency")
    },
    userFields: {
      userId: runtimeField(brand, "userId"),
      email: runtimeField(brand, "email"),
      displayName: runtimeField(brand, "displayName")
    },
    endpoints: {
      register: "runtime/register",
      login: "runtime/login",
      payments: "runtime/payments",
      config: "runtime/config"
    }
  };
}

export function toRuntimeAuthResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreAuthResponse
): unknown {
  return {
    sessionToken: response.sessionToken,
    user: mapUser(contract, response.user),
    account: mapAccount(contract, response.account)
  };
}

export function toRuntimeHistoryResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreHistoryResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    [contract.resourceAlias]: response.payments.map((payment) => mapPayment(contract, payment))
  };
}

export function toRuntimePaymentResponse(
  contract: BrandRuntimeContract,
  payment: PaymentCorePayment
): unknown {
  return {
    [contract.resourceAlias.slice(0, -1) || "payment"]: mapPayment(contract, payment)
  };
}

export function toCorePaymentRequest(
  contract: BrandRuntimeContract,
  payload: Record<string, unknown>
): PaymentCoreCreatePaymentRequest {
  const currency = optionalString(payload[contract.fields.currency] ?? payload.currency);
  const scenario = scenarioValue(payload.scenario);
  const methodType = methodTypeValue(payload[contract.fields.methodType] ?? payload.methodType);

  return {
    amount: numberValue(payload[contract.fields.amount] ?? payload.amount),
    destinationLabel: stringValue(payload[contract.fields.destinationLabel] ?? payload.destinationLabel),
    methodType,
    ...(currency ? { currency } : {}),
    ...(scenario ? { scenario } : {})
  };
}

function mapUser(contract: BrandRuntimeContract, user: PaymentCoreUser): Record<string, unknown> {
  return {
    [contract.userFields.userId]: user.userId,
    [contract.userFields.email]: user.email,
    [contract.userFields.displayName]: user.displayName
  };
}

function mapAccount(contract: BrandRuntimeContract, account: PaymentCoreAccount): Record<string, unknown> {
  return {
    [contract.accountFields.accountId]: account.accountId,
    [contract.accountFields.balance]: account.balance,
    [contract.accountFields.currency]: account.currency
  };
}

function mapPayment(contract: BrandRuntimeContract, payment: PaymentCorePayment): Record<string, unknown> {
  return {
    [contract.fields.paymentId]: payment.paymentId,
    [contract.fields.externalReference]: payment.externalReference,
    [contract.fields.status]: contract.statusMap[payment.status] ?? payment.status,
    [contract.fields.amount]: payment.amount,
    [contract.fields.currency]: payment.currency,
    [contract.fields.destinationLabel]: payment.destinationLabel,
    [contract.fields.methodType]: payment.methodType,
    [contract.fields.createdAt]: payment.createdAt
  };
}

function runtimeField(brand: BrandWithSchema, canonical: string): string {
  const suffix = createHash("sha1").update(`${brand.id}:runtime:${canonical}`).digest("hex").slice(0, 4);
  const base = canonical.replace(/([a-z])([A-Z])/gu, "$1_$2").toLowerCase();

  if (brand.schema.fieldsStyle === "camelCase") {
    return `${toCamel(base)}_${suffix}`;
  }

  if (brand.schema.fieldsStyle === "kebab-case") {
    return `${base.replaceAll("_", "-")}-${suffix}`;
  }

  return `${base}_${suffix}`;
}

function toCamel(value: string): string {
  return value
    .split("_")
    .map((part, index) => (index === 0 ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
    .join("");
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Expected non-empty string value");
  }

  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Expected positive payment amount");
  }

  return parsed;
}

function methodTypeValue(value: unknown): PaymentCoreMethodType {
  const method = optionalString(value) ?? "card";

  if (["card", "bank_transfer", "wallet", "crypto", "manual"].includes(method)) {
    return method as PaymentCoreMethodType;
  }

  return "card";
}

function scenarioValue(value: unknown): PaymentCoreCreatePaymentRequest["scenario"] {
  const scenario = optionalString(value);

  if (!scenario) {
    return undefined;
  }

  if (["demo", "requires_action", "fail", "review", "reserve", "settle", "refund"].includes(scenario)) {
    return scenario as PaymentCoreCreatePaymentRequest["scenario"];
  }

  return "demo";
}

const DEFAULT_ACTION_LABELS = {
  register: "Create access",
  login: "Sign in",
  createPayment: "Create payment",
  history: "Payment history",
  refund: "Refund"
};

const DEFAULT_STATUS_MAP: Record<PaymentCoreStatus, string> = {
  created: "created",
  requires_payment_method: "requiresMethod",
  requires_confirmation: "requiresConfirmation",
  processing: "processing",
  authorized: "authorized",
  captured: "captured",
  settled: "settled",
  failed: "failed",
  canceled: "canceled",
  refunded: "refunded"
};
