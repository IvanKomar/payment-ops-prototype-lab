import type {
  LayoutBuilderAiGenerationProfile,
  PaymentCoreAccount,
  PaymentCoreBalanceTransactionsResponse,
  PaymentCoreMethodType,
  PaymentCoreAuthResponse,
  PaymentCoreCreatePaymentRequest,
  PaymentCoreBrandResourcesResponse,
  PaymentCoreCreateCustomerRequest,
  PaymentCoreCreateCustomerResponse,
  PaymentCoreCreatePaymentMethodRequest,
  PaymentCoreCreatePaymentMethodResponse,
  PaymentCoreCustomersResponse,
  PaymentCoreHistoryResponse,
  PaymentCorePayment,
  PaymentCorePaymentIntentsResponse,
  PaymentCorePaymentMethodsResponse,
  PaymentCoreSeedBrandDemoResponse,
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
    paymentIntentId: string;
    customerId: string;
    paymentMethodId: string;
    status: string;
    amount: string;
    currency: string;
    destinationLabel: string;
    methodType: string;
    createdAt: string;
  };
  customerFields: {
    customerId: string;
    email: string;
    name: string;
    phone: string;
  };
  paymentMethodFields: {
    paymentMethodId: string;
    type: string;
    label: string;
    last4: string;
    brand: string;
    expiryMonth: string;
    expiryYear: string;
    bankName: string;
  };
  balanceFields: {
    balanceTransactionId: string;
    paymentId: string;
    type: string;
    amount: string;
    currency: string;
    description: string;
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
  authFields: {
    email: string;
    password: string;
    displayName: string;
    currency: string;
  };
  endpoints: {
    register: string;
    login: string;
    payments: string;
    customers: string;
    paymentMethods: string;
    paymentIntents: string;
    balanceTransactions: string;
    createCustomer: string;
    createPaymentMethod: string;
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
      paymentIntentId: runtimeField(brand, "paymentIntentId"),
      customerId: runtimeField(brand, "customerId"),
      paymentMethodId: runtimeField(brand, "paymentMethodId"),
      status: runtimeField(brand, "status"),
      amount: runtimeField(brand, "amount"),
      currency: runtimeField(brand, "currency"),
      destinationLabel: runtimeField(brand, "destinationLabel"),
      methodType: runtimeField(brand, "methodType"),
      createdAt: runtimeField(brand, "createdAt")
    },
    customerFields: {
      customerId: runtimeField(brand, "customerCustomerId"),
      email: runtimeField(brand, "customerEmail"),
      name: runtimeField(brand, "customerName"),
      phone: runtimeField(brand, "customerPhone")
    },
    paymentMethodFields: {
      paymentMethodId: runtimeField(brand, "methodPaymentMethodId"),
      type: runtimeField(brand, "methodType"),
      label: runtimeField(brand, "methodLabel"),
      last4: runtimeField(brand, "methodLast4"),
      brand: runtimeField(brand, "methodBrand"),
      expiryMonth: runtimeField(brand, "methodExpiryMonth"),
      expiryYear: runtimeField(brand, "methodExpiryYear"),
      bankName: runtimeField(brand, "methodBankName")
    },
    balanceFields: {
      balanceTransactionId: runtimeField(brand, "balanceTransactionId"),
      paymentId: runtimeField(brand, "balancePaymentId"),
      type: runtimeField(brand, "balanceType"),
      amount: runtimeField(brand, "balanceAmount"),
      currency: runtimeField(brand, "balanceCurrency"),
      description: runtimeField(brand, "balanceDescription"),
      createdAt: runtimeField(brand, "balanceCreatedAt")
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
    authFields: {
      email: runtimeField(brand, "authEmail"),
      password: runtimeField(brand, "authPassword"),
      displayName: runtimeField(brand, "authDisplayName"),
      currency: runtimeField(brand, "authCurrency")
    },
    endpoints: {
      register: "runtime/register",
      login: "runtime/login",
      payments: "runtime/payments",
      customers: "runtime/customers",
      paymentMethods: "runtime/payment-methods",
    paymentIntents: "runtime/payment-intents",
    balanceTransactions: "runtime/balance-transactions",
    createCustomer: "runtime/customers",
    createPaymentMethod: "runtime/payment-methods",
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
    customers: response.customers.map((customer) => mapCustomer(contract, customer)),
    paymentMethods: response.paymentMethods.map((method) => mapPaymentMethod(contract, method)),
    balanceTransactions: response.balanceTransactions.map((transaction) => mapBalanceTransaction(contract, transaction)),
    [contract.resourceAlias]: response.payments.map((payment) => mapPayment(contract, payment))
  };
}

export function toRuntimeCustomersResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreCustomersResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    customers: response.customers.map((customer) => mapCustomer(contract, customer))
  };
}

export function toRuntimeCustomerResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreCreateCustomerResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    customer: mapCustomer(contract, response.customer)
  };
}

export function toRuntimePaymentMethodsResponse(
  contract: BrandRuntimeContract,
  response: PaymentCorePaymentMethodsResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    paymentMethods: response.paymentMethods.map((method) => mapPaymentMethod(contract, method))
  };
}

export function toRuntimePaymentMethodResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreCreatePaymentMethodResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    paymentMethod: mapPaymentMethod(contract, response.paymentMethod)
  };
}

export function toRuntimePaymentIntentsResponse(
  contract: BrandRuntimeContract,
  response: PaymentCorePaymentIntentsResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    paymentIntents: response.paymentIntents.map((intent) => ({
      [contract.fields.paymentIntentId]: intent.paymentIntentId,
      [contract.fields.externalReference]: intent.externalReference,
      [contract.fields.customerId]: intent.customerId,
      [contract.fields.paymentMethodId]: intent.paymentMethodId,
      [contract.fields.status]: contract.statusMap[intent.status] ?? intent.status,
      [contract.fields.amount]: intent.amount,
      [contract.fields.currency]: intent.currency,
      [contract.fields.createdAt]: intent.createdAt
    }))
  };
}

export function toRuntimeBalanceTransactionsResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreBalanceTransactionsResponse
): unknown {
  return {
    account: mapAccount(contract, response.account),
    balanceTransactions: response.balanceTransactions.map((transaction) => mapBalanceTransaction(contract, transaction))
  };
}

export function toRuntimeAdminResourcesResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreBrandResourcesResponse | PaymentCoreSeedBrandDemoResponse
): unknown {
  return {
    accounts: response.accounts.map((account) => mapAccount(contract, account)),
    balanceTransactions: response.balanceTransactions.map((transaction) => mapBalanceTransaction(contract, transaction)),
    brandId: response.brandId,
    customers: response.customers.map((customer) => mapCustomer(contract, customer)),
    paymentIntents: response.paymentIntents.map((intent) => ({
      [contract.fields.paymentIntentId]: intent.paymentIntentId,
      [contract.fields.externalReference]: intent.externalReference,
      [contract.fields.customerId]: intent.customerId,
      [contract.fields.paymentMethodId]: intent.paymentMethodId,
      [contract.fields.status]: contract.statusMap[intent.status] ?? intent.status,
      [contract.fields.amount]: intent.amount,
      [contract.fields.currency]: intent.currency,
      [contract.fields.createdAt]: intent.createdAt
    })),
    paymentMethods: response.paymentMethods.map((method) => mapPaymentMethod(contract, method)),
    payments: response.payments.map((payment) => mapPayment(contract, payment)),
    users: response.users.map((user) => mapUser(contract, user)),
    ...("createdPayments" in response
      ? {
          createdPayments: response.createdPayments.map((payment) => mapPayment(contract, payment)),
          demoAccount: mapAccount(contract, response.demoAccount),
          demoSessionToken: response.demoSessionToken,
          demoUser: mapUser(contract, response.demoUser)
        }
      : {})
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
  const customer = objectValue(payload.customer);
  const paymentMethod = objectValue(payload.paymentMethod);
  const customerName = optionalString(customer?.[contract.customerFields.name] ?? customer?.name);
  const customerEmail = optionalString(customer?.[contract.customerFields.email] ?? customer?.email);
  const customerPhone = optionalString(customer?.[contract.customerFields.phone] ?? customer?.phone);
  const paymentMethodType = methodTypeValue(paymentMethod?.[contract.paymentMethodFields.type] ?? paymentMethod?.type ?? methodType);
  const paymentMethodLast4 = optionalString(paymentMethod?.[contract.paymentMethodFields.last4] ?? paymentMethod?.last4);
  const paymentMethodLabel = optionalString(paymentMethod?.[contract.paymentMethodFields.label] ?? paymentMethod?.label);
  const paymentMethodBrand = optionalString(paymentMethod?.[contract.paymentMethodFields.brand] ?? paymentMethod?.brand);
  const paymentMethodBankName = optionalString(paymentMethod?.[contract.paymentMethodFields.bankName] ?? paymentMethod?.bankName);
  const paymentMethodExpiryMonth = optionalNumber(paymentMethod?.[contract.paymentMethodFields.expiryMonth] ?? paymentMethod?.expiryMonth);
  const paymentMethodExpiryYear = optionalNumber(paymentMethod?.[contract.paymentMethodFields.expiryYear] ?? paymentMethod?.expiryYear);

  return {
    amount: numberValue(payload[contract.fields.amount] ?? payload.amount),
    ...(optionalString(payload[contract.fields.destinationLabel] ?? payload.destinationLabel)
      ? { destinationLabel: stringValue(payload[contract.fields.destinationLabel] ?? payload.destinationLabel) }
      : {}),
    methodType: paymentMethodType,
    ...(customerName
      ? {
          customer: {
            name: customerName,
            ...(customerEmail ? { email: customerEmail } : {}),
            ...(customerPhone ? { phone: customerPhone } : {})
          }
        }
      : {}),
    paymentMethod: {
      type: paymentMethodType,
      ...(paymentMethodLabel ? { label: paymentMethodLabel } : {}),
      ...(paymentMethodLast4 ? { last4: paymentMethodLast4 } : {}),
      ...(paymentMethodBrand ? { brand: paymentMethodBrand } : {}),
      ...(paymentMethodBankName ? { bankName: paymentMethodBankName } : {}),
      ...(paymentMethodExpiryMonth ? { expiryMonth: paymentMethodExpiryMonth } : {}),
      ...(paymentMethodExpiryYear ? { expiryYear: paymentMethodExpiryYear } : {})
    },
    ...(currency ? { currency } : {}),
    ...(scenario ? { scenario } : {})
  };
}

export function toCoreCustomerRequest(
  contract: BrandRuntimeContract,
  payload: Record<string, unknown>
): PaymentCoreCreateCustomerRequest {
  const email = optionalString(payload[contract.customerFields.email] ?? payload.email);
  const phone = optionalString(payload[contract.customerFields.phone] ?? payload.phone);

  return {
    name: stringValue(payload[contract.customerFields.name] ?? payload.name),
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {})
  };
}

export function toCorePaymentMethodRequest(
  contract: BrandRuntimeContract,
  payload: Record<string, unknown>
): PaymentCoreCreatePaymentMethodRequest {
  const customerId = optionalString(payload[contract.customerFields.customerId] ?? payload.customerId);
  const type = methodTypeValue(payload[contract.paymentMethodFields.type] ?? payload.type);
  const label = optionalString(payload[contract.paymentMethodFields.label] ?? payload.label);
  const last4 = optionalString(payload[contract.paymentMethodFields.last4] ?? payload.last4);
  const brand = optionalString(payload[contract.paymentMethodFields.brand] ?? payload.brand);
  const expiryMonth = optionalNumber(payload[contract.paymentMethodFields.expiryMonth] ?? payload.expiryMonth);
  const expiryYear = optionalNumber(payload[contract.paymentMethodFields.expiryYear] ?? payload.expiryYear);
  const bankName = optionalString(payload[contract.paymentMethodFields.bankName] ?? payload.bankName);

  return {
    type,
    ...(customerId ? { customerId } : {}),
    ...(label ? { label } : {}),
    ...(last4 ? { last4 } : {}),
    ...(brand ? { brand } : {}),
    ...(expiryMonth ? { expiryMonth } : {}),
    ...(expiryYear ? { expiryYear } : {}),
    ...(bankName ? { bankName } : {})
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

function mapCustomer(contract: BrandRuntimeContract, customer: NonNullable<PaymentCorePayment["customer"]>): Record<string, unknown> {
  return {
    [contract.customerFields.customerId]: customer.customerId,
    [contract.customerFields.email]: customer.email,
    [contract.customerFields.name]: customer.name,
    [contract.customerFields.phone]: customer.phone
  };
}

function mapPaymentMethod(
  contract: BrandRuntimeContract,
  method: NonNullable<PaymentCorePayment["paymentMethod"]>
): Record<string, unknown> {
  return {
    [contract.paymentMethodFields.paymentMethodId]: method.paymentMethodId,
    [contract.paymentMethodFields.type]: method.type,
    [contract.paymentMethodFields.label]: method.label,
    [contract.paymentMethodFields.last4]: method.last4,
    [contract.paymentMethodFields.brand]: method.brand,
    [contract.paymentMethodFields.expiryMonth]: method.expiryMonth,
    [contract.paymentMethodFields.expiryYear]: method.expiryYear,
    [contract.paymentMethodFields.bankName]: method.bankName
  };
}

function mapBalanceTransaction(
  contract: BrandRuntimeContract,
  transaction: PaymentCoreBalanceTransactionsResponse["balanceTransactions"][number]
): Record<string, unknown> {
  return {
    [contract.balanceFields.balanceTransactionId]: transaction.balanceTransactionId,
    [contract.balanceFields.paymentId]: transaction.paymentId,
    [contract.balanceFields.type]: transaction.type,
    [contract.balanceFields.amount]: transaction.amount,
    [contract.balanceFields.currency]: transaction.currency,
    [contract.balanceFields.description]: transaction.description,
    [contract.balanceFields.createdAt]: transaction.createdAt
  };
}

function mapPayment(contract: BrandRuntimeContract, payment: PaymentCorePayment): Record<string, unknown> {
  return {
    [contract.fields.paymentId]: payment.paymentId,
    [contract.fields.externalReference]: payment.externalReference,
    [contract.fields.paymentIntentId]: payment.paymentIntentId,
    [contract.fields.customerId]: payment.customerId,
    [contract.fields.paymentMethodId]: payment.paymentMethodId,
    [contract.fields.status]: contract.statusMap[payment.status] ?? payment.status,
    [contract.fields.amount]: payment.amount,
    [contract.fields.currency]: payment.currency,
    [contract.fields.destinationLabel]: payment.destinationLabel,
    [contract.fields.methodType]: payment.methodType,
    [contract.fields.createdAt]: payment.createdAt,
    customer: payment.customer ? mapCustomer(contract, payment.customer) : null,
    paymentMethod: payment.paymentMethod ? mapPaymentMethod(contract, payment.paymentMethod) : null
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

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function objectValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
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
