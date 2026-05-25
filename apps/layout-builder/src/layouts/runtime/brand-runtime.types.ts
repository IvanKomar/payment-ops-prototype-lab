import type {
  LayoutBuilderAiBrandSpec,
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
    sessionToken: string;
  };
  responseKeys: {
    account: string;
    metrics: string;
    payments: string;
    customers: string;
    paymentMethods: string;
    balances: string;
    error: string;
  };
  endpoints: {
    account: string;
    appShell: string;
    balances: string;
    overview: string;
    metrics: string;
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
  const persistedContract = brand.schema.contractVersion;
  const resourceAlias = persistedContract?.resourceAlias ?? generation?.resourceAlias ?? "payments";
  const endpointAliases = {
    ...brandEndpointAliases(brand, resourceAlias),
    ...(persistedContract?.endpoints ?? {})
  };
  const fieldMap = persistedContract?.fieldMap ?? {};

  return {
    brandId: brand.id,
    brandName: brand.name,
    resourceAlias,
    statusMap: persistedContract?.statusMap ?? generation?.statusMap ?? DEFAULT_STATUS_MAP,
    actionLabels: persistedContract?.actionLabels ?? generation?.actionLabels ?? DEFAULT_ACTION_LABELS,
    fields: {
      paymentId: contractField(fieldMap, "payment.paymentId", runtimeField(brand, "paymentId")),
      externalReference: contractField(fieldMap, "payment.externalReference", runtimeField(brand, "externalReference")),
      paymentIntentId: contractField(fieldMap, "payment.paymentIntentId", runtimeField(brand, "paymentIntentId")),
      customerId: contractField(fieldMap, "payment.customerId", runtimeField(brand, "customerId")),
      paymentMethodId: contractField(fieldMap, "payment.paymentMethodId", runtimeField(brand, "paymentMethodId")),
      status: contractField(fieldMap, "payment.status", runtimeField(brand, "status")),
      amount: contractField(fieldMap, "payment.amount", runtimeField(brand, "amount")),
      currency: contractField(fieldMap, "payment.currency", runtimeField(brand, "currency")),
      destinationLabel: contractField(fieldMap, "payment.destinationLabel", runtimeField(brand, "destinationLabel")),
      methodType: contractField(fieldMap, "payment.methodType", runtimeField(brand, "methodType")),
      createdAt: contractField(fieldMap, "payment.createdAt", runtimeField(brand, "createdAt"))
    },
    customerFields: {
      customerId: contractField(fieldMap, "customer.customerId", runtimeField(brand, "customerCustomerId")),
      email: contractField(fieldMap, "customer.email", runtimeField(brand, "customerEmail")),
      name: contractField(fieldMap, "customer.name", runtimeField(brand, "customerName")),
      phone: contractField(fieldMap, "customer.phone", runtimeField(brand, "customerPhone"))
    },
    paymentMethodFields: {
      paymentMethodId: contractField(fieldMap, "method.paymentMethodId", runtimeField(brand, "methodPaymentMethodId")),
      type: contractField(fieldMap, "method.type", runtimeField(brand, "methodType")),
      label: contractField(fieldMap, "method.label", runtimeField(brand, "methodLabel")),
      last4: contractField(fieldMap, "method.last4", runtimeField(brand, "methodLast4")),
      brand: contractField(fieldMap, "method.brand", runtimeField(brand, "methodBrand")),
      expiryMonth: contractField(fieldMap, "method.expiryMonth", runtimeField(brand, "methodExpiryMonth")),
      expiryYear: contractField(fieldMap, "method.expiryYear", runtimeField(brand, "methodExpiryYear")),
      bankName: contractField(fieldMap, "method.bankName", runtimeField(brand, "methodBankName"))
    },
    balanceFields: {
      balanceTransactionId: contractField(fieldMap, "balance.balanceTransactionId", runtimeField(brand, "balanceTransactionId")),
      paymentId: contractField(fieldMap, "balance.paymentId", runtimeField(brand, "balancePaymentId")),
      type: contractField(fieldMap, "balance.type", runtimeField(brand, "balanceType")),
      amount: contractField(fieldMap, "balance.amount", runtimeField(brand, "balanceAmount")),
      currency: contractField(fieldMap, "balance.currency", runtimeField(brand, "balanceCurrency")),
      description: contractField(fieldMap, "balance.description", runtimeField(brand, "balanceDescription")),
      createdAt: contractField(fieldMap, "balance.createdAt", runtimeField(brand, "balanceCreatedAt"))
    },
    accountFields: {
      accountId: contractField(fieldMap, "account.accountId", runtimeField(brand, "accountId")),
      balance: contractField(fieldMap, "account.balance", runtimeField(brand, "balance")),
      currency: contractField(fieldMap, "account.currency", runtimeField(brand, "accountCurrency"))
    },
    userFields: {
      userId: contractField(fieldMap, "user.userId", runtimeField(brand, "userId")),
      email: contractField(fieldMap, "user.email", runtimeField(brand, "email")),
      displayName: contractField(fieldMap, "user.displayName", runtimeField(brand, "displayName"))
    },
    authFields: {
      email: contractField(fieldMap, "auth.email", runtimeField(brand, "authEmail")),
      password: contractField(fieldMap, "auth.password", runtimeField(brand, "authPassword")),
      displayName: contractField(fieldMap, "auth.displayName", runtimeField(brand, "authDisplayName")),
      currency: contractField(fieldMap, "auth.currency", runtimeField(brand, "authCurrency")),
      sessionToken: contractField(fieldMap, "auth.sessionToken", "sessionToken")
    },
    responseKeys: {
      account: contractField(fieldMap, "response.account", "account"),
      metrics: contractField(fieldMap, "response.metrics", "metrics"),
      payments: contractField(fieldMap, "response.payments", "payments"),
      customers: contractField(fieldMap, "response.customers", "customers"),
      paymentMethods: contractField(fieldMap, "response.paymentMethods", "paymentMethods"),
      balances: contractField(fieldMap, "response.balances", "balances"),
      error: contractField(fieldMap, "response.error", "error")
    },
    endpoints: {
      account: `bff/${endpointAliases.account}`,
      appShell: `bff/${endpointAliases.appShell}`,
      balances: `bff/${endpointAliases.balances}`,
      overview: `bff/${endpointAliases.overview}`,
      metrics: `bff/${endpointAliases.metrics}`,
      register: `bff/${endpointAliases.register}`,
      login: `bff/${endpointAliases.login}`,
      payments: `bff/${endpointAliases.payments}`,
      customers: `bff/${endpointAliases.customers}`,
      paymentMethods: `bff/${endpointAliases.paymentMethods}`,
      paymentIntents: `bff/${endpointAliases.paymentIntents}`,
      balanceTransactions: `bff/${endpointAliases.balanceTransactions}`,
      createCustomer: `bff/${endpointAliases.customers}`,
      createPaymentMethod: `bff/${endpointAliases.paymentMethods}`,
      config: `bff/${endpointAliases.config}`
    }
  };
}

export type BrandRuntimeGatewayOperation =
  | "appShell"
  | "overview"
  | "config"
  | "account"
  | "metrics"
  | "register"
  | "login"
  | "payments"
  | "customers"
  | "paymentMethods"
  | "paymentIntents"
  | "balanceTransactions"
  | "balances";

export function resolveBrandRuntimeGatewayOperation(
  contract: BrandRuntimeContract,
  method: "GET" | "POST",
  alias: string
): BrandRuntimeGatewayOperation | null {
  const normalizedAlias = alias.trim();

  if (method === "GET") {
    return (
      matchFixedAlias(normalizedAlias, "entrypoint", "appShell") ??
      matchAlias(contract.endpoints.appShell, normalizedAlias, "appShell") ??
      matchAlias(contract.endpoints.overview, normalizedAlias, "overview") ??
      matchAlias(contract.endpoints.config, normalizedAlias, "config") ??
      matchAlias(contract.endpoints.account, normalizedAlias, "account") ??
      matchAlias(contract.endpoints.metrics, normalizedAlias, "metrics") ??
      matchAlias(contract.endpoints.payments, normalizedAlias, "payments") ??
      matchAlias(contract.endpoints.customers, normalizedAlias, "customers") ??
      matchAlias(contract.endpoints.paymentMethods, normalizedAlias, "paymentMethods") ??
      matchAlias(contract.endpoints.paymentIntents, normalizedAlias, "paymentIntents") ??
      matchAlias(contract.endpoints.balanceTransactions, normalizedAlias, "balanceTransactions") ??
      matchAlias(contract.endpoints.balances, normalizedAlias, "balances")
    );
  }

  return (
    matchAlias(contract.endpoints.register, normalizedAlias, "register") ??
    matchAlias(contract.endpoints.login, normalizedAlias, "login") ??
    matchAlias(contract.endpoints.payments, normalizedAlias, "payments") ??
    matchAlias(contract.endpoints.customers, normalizedAlias, "customers") ??
    matchAlias(contract.endpoints.paymentMethods, normalizedAlias, "paymentMethods")
  );
}

export function toRuntimeAuthResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreAuthResponse
): unknown {
  return {
    [contract.authFields.sessionToken]: response.sessionToken,
    user: mapUser(contract, response.user),
    account: mapAccount(contract, response.account)
  };
}

export interface RuntimeAppShellResponse {
  brand: {
    brandId: string;
    logoDataUri: string | null;
    name: string;
    palette: BrandWithSchema["palette"];
  };
  copy: {
    contractSummary: string;
    visualDirection: string;
  };
  endpoints: {
    account: string;
    balanceTransactions: string;
    balances: string;
    customers: string;
    login: string;
    metrics: string;
    overview: string;
    paymentMethods: string;
    payments: string;
    register: string;
  };
  labels: {
    balances: string;
    createPayment: string;
    customers: string;
    history: string;
    login: string;
    overview: string;
    payments: string;
    register: string;
  };
  auth: {
    tokenResponseKey: string;
    fields: {
      currency: string;
      displayName: string;
      email: string;
      password: string;
    };
  };
  fields: {
    account: BrandRuntimeContract["accountFields"];
    balance: BrandRuntimeContract["balanceFields"];
    customer: BrandRuntimeContract["customerFields"];
    metrics: Record<string, string>;
    payment: BrandRuntimeContract["fields"];
    paymentMethod: BrandRuntimeContract["paymentMethodFields"];
    responseKeys: BrandRuntimeContract["responseKeys"];
  };
  ui: LayoutBuilderAiBrandSpec["ui"] | null;
}

export interface PublicBrandProfileResponse {
  brand: {
    logoDataUri: string | null;
    name: string;
    palette: BrandWithSchema["palette"];
  };
  copy: {
    contractSummary: string;
    visualDirection: string;
  };
  labels: {
    balances: string;
    createPayment: string;
    customers: string;
    history: string;
    login: string;
    overview: string;
    payments: string;
    register: string;
  };
  routes: {
    account: string;
    balances: string;
    customers: string;
    login: string;
    metrics: string;
    paymentMethods: string;
    payments: string;
    register: string;
  };
  auth: RuntimeAppShellResponse["auth"];
  fields: RuntimeAppShellResponse["fields"];
  ui: RuntimeAppShellResponse["ui"];
}

export function toPublicBrandProfileResponse(
  brand: BrandWithSchema,
  contract: BrandRuntimeContract,
  logoDataUri: string | null
): PublicBrandProfileResponse {
  const shell = toRuntimeAppShellResponse(brand, contract, logoDataUri);

  return {
    brand: {
      logoDataUri: shell.brand.logoDataUri,
      name: shell.brand.name,
      palette: shell.brand.palette
    },
    copy: shell.copy,
    labels: shell.labels,
    routes: {
      account: publicEndpointAlias(shell.endpoints.account),
      balances: publicEndpointAlias(shell.endpoints.balances),
      customers: publicEndpointAlias(shell.endpoints.customers),
      login: publicEndpointAlias(shell.endpoints.login),
      metrics: publicEndpointAlias(shell.endpoints.metrics),
      paymentMethods: publicEndpointAlias(shell.endpoints.paymentMethods),
      payments: publicEndpointAlias(shell.endpoints.payments),
      register: publicEndpointAlias(shell.endpoints.register)
    },
    auth: {
      tokenResponseKey: contract.authFields.sessionToken,
      fields: {
        currency: contract.authFields.currency,
        displayName: contract.authFields.displayName,
        email: contract.authFields.email,
        password: contract.authFields.password
      }
    },
    fields: {
      account: contract.accountFields,
      balance: contract.balanceFields,
      customer: contract.customerFields,
      metrics: {
        count: contractField(contract.responseKeys, "count", "count"),
        currency: contractField(contract.responseKeys, "currency", "currency"),
        customers: contractField(contract.responseKeys, "customers", "customers"),
        review: contractField(contract.responseKeys, "review", "review"),
        volume: contractField(contract.responseKeys, "volume", "volume")
      },
      payment: contract.fields,
      paymentMethod: contract.paymentMethodFields,
      responseKeys: contract.responseKeys
    },
    ui: brand.schema.contractVersion?.aiSpec?.ui ?? null
  };
}

export function toRuntimeAppShellResponse(
  brand: BrandWithSchema,
  contract: BrandRuntimeContract,
  logoDataUri: string | null
): RuntimeAppShellResponse {
  const actionLabels = contract.actionLabels;
  const uiLabels = brand.schema.contractVersion?.aiSpec?.ui.labels;

  return {
    brand: {
      brandId: brand.id,
      logoDataUri,
      name: brand.name,
      palette: brand.palette
    },
    copy: {
      contractSummary: brand.schema.generationProfile?.contractSummary ?? `${brand.name} merchant payment workspace`,
      visualDirection:
        brand.schema.generationProfile?.visualDirection ??
        "Operate payments, balances, and account activity from one workspace."
    },
    endpoints: {
      account: contract.endpoints.account,
      balanceTransactions: contract.endpoints.balanceTransactions,
      balances: contract.endpoints.balances,
      customers: contract.endpoints.customers,
      login: contract.endpoints.login,
      metrics: contract.endpoints.metrics,
      overview: contract.endpoints.overview,
      paymentMethods: contract.endpoints.paymentMethods,
      payments: contract.endpoints.payments,
      register: contract.endpoints.register
    },
    labels: {
      balances: uiLabels?.balances ?? "Balances",
      createPayment: uiLabels?.createPayment ?? actionLabels.createPayment,
      customers: uiLabels?.customers ?? humanizeResource(contract.resourceAlias, "Customers"),
      history: uiLabels?.history ?? actionLabels.history,
      login: uiLabels?.login ?? actionLabels.login,
      overview: uiLabels?.overview ?? "Overview",
      payments: uiLabels?.payments ?? humanizeResource(contract.resourceAlias, "Payments"),
      register: uiLabels?.register ?? actionLabels.register
    },
    auth: {
      tokenResponseKey: contract.authFields.sessionToken,
      fields: {
        currency: contract.authFields.currency,
        displayName: contract.authFields.displayName,
        email: contract.authFields.email,
        password: contract.authFields.password
      }
    },
    fields: {
      account: contract.accountFields,
      balance: contract.balanceFields,
      customer: contract.customerFields,
      metrics: {
        count: "count",
        currency: "currency",
        customers: "customers",
        review: "review",
        volume: "volume"
      },
      payment: contract.fields,
      paymentMethod: contract.paymentMethodFields,
      responseKeys: contract.responseKeys
    },
    ui: brand.schema.contractVersion?.aiSpec?.ui ?? null
  };
}

export function toRuntimeOverviewResponse(
  contract: BrandRuntimeContract,
  response: PaymentCoreHistoryResponse
): unknown {
  const payments = response.payments.map((payment) => mapPublicPayment(contract, payment));
  const customers = response.customers.map((customer) => mapPublicCustomer(customer));
  const paymentMethods = response.paymentMethods.map((method) => mapPublicPaymentMethod(method));
  const balanceTransactions = response.balanceTransactions.map((transaction) => mapPublicBalanceTransaction(transaction));

  return {
    account: mapPublicAccount(response.account),
    balanceTransactions,
    customers,
    metrics: publicMetrics(payments, customers),
    paymentMethods,
    payments
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
    payment: mapPublicPayment(contract, payment),
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
    [contract.balanceFields.paymentId]: publicRuntimeReference(transaction.paymentId, "PM"),
    [contract.balanceFields.type]: transaction.type,
    [contract.balanceFields.amount]: transaction.amount,
    [contract.balanceFields.currency]: transaction.currency,
    [contract.balanceFields.description]: transaction.description,
    [contract.balanceFields.createdAt]: transaction.createdAt
  };
}

function mapPayment(contract: BrandRuntimeContract, payment: PaymentCorePayment): Record<string, unknown> {
  return {
    [contract.fields.paymentId]: publicRuntimeReference(payment.paymentId, "PM"),
    [contract.fields.externalReference]: publicRuntimeReference(payment.paymentId, "TX"),
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

function mapPublicAccount(account: PaymentCoreAccount): Record<string, unknown> {
  return {
    id: account.accountId,
    balance: account.balance,
    currency: account.currency
  };
}

function mapPublicCustomer(customer: NonNullable<PaymentCorePayment["customer"]>): Record<string, unknown> {
  return {
    id: customer.customerId,
    email: customer.email,
    name: customer.name,
    phone: customer.phone
  };
}

function mapPublicPaymentMethod(method: NonNullable<PaymentCorePayment["paymentMethod"]>): Record<string, unknown> {
  return {
    id: method.paymentMethodId,
    bankName: method.bankName,
    brand: method.brand,
    expiryMonth: method.expiryMonth,
    expiryYear: method.expiryYear,
    label: method.label,
    last4: method.last4,
    type: method.type
  };
}

function mapPublicBalanceTransaction(
  transaction: PaymentCoreBalanceTransactionsResponse["balanceTransactions"][number]
): Record<string, unknown> {
  return {
    id: transaction.balanceTransactionId,
    paymentId: publicRuntimeReference(transaction.paymentId, "PM"),
    type: transaction.type,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    createdAt: transaction.createdAt
  };
}

function mapPublicPayment(contract: BrandRuntimeContract, payment: PaymentCorePayment): Record<string, unknown> {
  return {
    id: publicRuntimeReference(payment.paymentId, "PM"),
    reference: publicRuntimeReference(payment.paymentId, "TX"),
    intentId: payment.paymentIntentId,
    customerId: payment.customerId,
    paymentMethodId: payment.paymentMethodId,
    status: contract.statusMap[payment.status] ?? payment.status,
    amount: payment.amount,
    currency: payment.currency,
    destination: payment.destinationLabel,
    methodType: payment.methodType,
    createdAt: payment.createdAt,
    customer: payment.customer ? mapPublicCustomer(payment.customer) : null,
    paymentMethod: payment.paymentMethod ? mapPublicPaymentMethod(payment.paymentMethod) : null
  };
}

function publicRuntimeReference(value: string | null | undefined, prefix: string): string {
  const token = (value ?? "")
    .replace(/[^a-z0-9]/giu, "")
    .toUpperCase()
    .slice(-10)
    .padStart(10, "0");

  return `${prefix}-${token.slice(0, 4)}-${token.slice(4, 8)}`;
}

function publicMetrics(
  payments: Array<Record<string, unknown>>,
  customers: Array<Record<string, unknown>>
): Record<string, unknown> {
  const currency = typeof payments[0]?.currency === "string" ? payments[0].currency : "USD";
  const volume = payments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const review = payments.filter((payment) => statusKind(String(payment.status ?? "")) !== "ok").length;

  return {
    count: payments.length,
    currency,
    customers: customers.length,
    review,
    volume
  };
}

function statusKind(status: string): "bad" | "ok" | "warn" | "muted" {
  const lower = status.toLowerCase();

  if (lower.includes("fail") || lower.includes("reject") || lower.includes("declin")) {
    return "bad";
  }

  if (lower.includes("clear") || lower.includes("paid") || lower.includes("settle") || lower.includes("complete")) {
    return "ok";
  }

  if (lower.includes("review") || lower.includes("process") || lower.includes("queue") || lower.includes("confirm")) {
    return "warn";
  }

  return "muted";
}

function runtimeField(brand: BrandWithSchema, canonical: string): string {
  const variants = FIELD_NAME_VARIANTS[canonical] ?? [canonical];
  const base = pick(variants, hashToNumber(`${brand.id}:runtime-field:${canonical}`));

  if (brand.schema.fieldsStyle === "camelCase") {
    return toCamel(base);
  }

  if (brand.schema.fieldsStyle === "kebab-case") {
    return base.replaceAll("_", "-");
  }

  return base;
}

function contractField(fieldMap: Record<string, string>, key: string, fallback: string): string {
  const value = fieldMap[key];

  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function brandEndpointAliases(brand: BrandWithSchema, resourceAlias: string): BrandRuntimeContract["endpoints"] {
  return {
    account: endpointAlias(brand, "account"),
    appShell: endpointAlias(brand, "appShell"),
    balances: endpointAlias(brand, "balances"),
    overview: endpointAlias(brand, "overview"),
    metrics: endpointAlias(brand, "metrics"),
    register: endpointAlias(brand, "register"),
    login: endpointAlias(brand, "login"),
    payments: endpointAlias(brand, "payments", resourceAlias),
    customers: endpointAlias(brand, "customers"),
    paymentMethods: endpointAlias(brand, "paymentMethods"),
    paymentIntents: endpointAlias(brand, "paymentIntents"),
    balanceTransactions: endpointAlias(brand, "balanceTransactions"),
    createCustomer: endpointAlias(brand, "customers"),
    createPaymentMethod: endpointAlias(brand, "paymentMethods"),
    config: endpointAlias(brand, "config")
  };
}

function endpointAlias(brand: BrandWithSchema, key: string, resourceAlias?: string): string {
  const variants = ENDPOINT_ALIAS_VARIANTS[key] ?? [resourceAlias ?? key];
  const picked = pick(variants, hashToNumber(`${brand.id}:bff-alias:${key}:${resourceAlias ?? ""}`));

  return slugify(picked);
}

export function resolvePublicBrandEntityOperation(
  contract: BrandRuntimeContract,
  method: "GET" | "POST",
  alias: string
): BrandRuntimeGatewayOperation | null {
  const normalizedAlias = alias.trim();

  if (method === "GET") {
    return (
      matchAlias(contract.endpoints.account, normalizedAlias, "account") ??
      matchAlias(contract.endpoints.metrics, normalizedAlias, "metrics") ??
      matchAlias(contract.endpoints.payments, normalizedAlias, "payments") ??
      matchAlias(contract.endpoints.customers, normalizedAlias, "customers") ??
      matchAlias(contract.endpoints.paymentMethods, normalizedAlias, "paymentMethods") ??
      matchAlias(contract.endpoints.balances, normalizedAlias, "balances") ??
      matchAlias(contract.endpoints.balanceTransactions, normalizedAlias, "balanceTransactions")
    );
  }

  return (
    matchAlias(contract.endpoints.register, normalizedAlias, "register") ??
    matchAlias(contract.endpoints.login, normalizedAlias, "login") ??
    matchAlias(contract.endpoints.payments, normalizedAlias, "payments") ??
    matchAlias(contract.endpoints.customers, normalizedAlias, "customers") ??
    matchAlias(contract.endpoints.paymentMethods, normalizedAlias, "paymentMethods")
  );
}

function matchAlias<T extends BrandRuntimeGatewayOperation>(
  endpoint: string,
  alias: string,
  operation: T
): T | null {
  return endpoint.split("/").at(-1) === alias ? operation : null;
}

function matchFixedAlias<T extends BrandRuntimeGatewayOperation>(alias: string, expected: string, operation: T): T | null {
  return alias === expected ? operation : null;
}

function toCamel(value: string): string {
  return value
    .split("_")
    .map((part, index) => (index === 0 ? part : `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`))
    .join("");
}

function slugify(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/gu, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/-{2,}/gu, "-");
}

function pick<T>(items: readonly T[], seed: number): T {
  return items[Math.abs(seed) % items.length]!;
}

function hashToNumber(value: string): number {
  return Number.parseInt(createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
}

function humanizeResource(value: string, fallback: string): string {
  const words = value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[-_]+/gu, " ")
    .trim();

  return words.length > 0 ? `${words.slice(0, 1).toUpperCase()}${words.slice(1)}` : fallback;
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

const FIELD_NAME_VARIANTS: Record<string, readonly string[]> = {
  paymentId: ["payment_key", "charge_ref", "transfer_code", "case_marker", "settlement_ref"],
  externalReference: ["merchant_ref", "order_marker", "tracking_code", "client_reference", "ledger_ref"],
  paymentIntentId: ["route_ref", "intent_marker", "authorization_ref", "processing_ticket", "flow_ref"],
  customerId: ["buyer_key", "client_marker", "payer_ref", "profile_code", "account_party"],
  paymentMethodId: ["funding_key", "source_marker", "instrument_ref", "rail_code", "method_token"],
  status: ["lifecycle", "review_state", "flow_state", "case_stage", "settlement_state"],
  amount: ["gross_value", "money_value", "transfer_amount", "settlement_total", "payable_value"],
  currency: ["money_unit", "settlement_currency", "value_currency", "ledger_currency", "account_unit"],
  destinationLabel: ["counterparty", "recipient_note", "customer_route", "payee_label", "destination_hint"],
  methodType: ["funding_rail", "source_type", "payment_channel", "instrument_kind", "route_method"],
  createdAt: ["opened_on", "booked_at", "initiated_at", "recorded_on", "timeline_stamp"],
  customerCustomerId: ["profile_key", "customer_marker", "buyer_profile", "party_ref", "client_key"],
  customerEmail: ["contact_mail", "buyer_mail", "profile_email", "payer_contact", "client_inbox"],
  customerName: ["display_party", "buyer_name", "profile_name", "customer_label", "client_title"],
  customerPhone: ["contact_phone", "buyer_phone", "profile_phone", "payer_phone", "client_line"],
  methodPaymentMethodId: ["instrument_key", "funding_ref", "source_key", "rail_token", "method_ref"],
  methodLabel: ["instrument_label", "funding_label", "source_title", "rail_caption", "method_name"],
  methodLast4: ["source_tail", "instrument_tail", "rail_suffix", "last_digits", "method_hint"],
  methodBrand: ["scheme_name", "card_scheme", "network_name", "instrument_brand", "rail_brand"],
  methodExpiryMonth: ["valid_month", "expiry_period", "card_month", "instrument_month", "valid_through_month"],
  methodExpiryYear: ["valid_year", "expiry_year", "card_year", "instrument_year", "valid_through_year"],
  methodBankName: ["bank_label", "institution_name", "rail_bank", "source_bank", "funding_bank"],
  balanceTransactionId: ["ledger_line", "movement_key", "balance_marker", "posting_ref", "account_entry"],
  balancePaymentId: ["linked_payment", "source_payment", "case_payment", "settlement_payment", "posting_payment"],
  balanceType: ["movement_type", "posting_kind", "ledger_action", "balance_event", "entry_type"],
  balanceAmount: ["movement_value", "posted_value", "ledger_amount", "balance_delta", "entry_value"],
  balanceCurrency: ["movement_unit", "posting_currency", "ledger_unit", "balance_currency", "entry_currency"],
  balanceDescription: ["posting_note", "ledger_note", "movement_memo", "balance_reason", "entry_description"],
  accountId: ["merchant_account", "ledger_account", "workspace_account", "settlement_account", "wallet_profile"],
  balance: ["available_funds", "settlement_float", "ledger_balance", "account_reserve", "cash_position"],
  accountCurrency: ["account_unit", "home_currency", "settlement_unit", "wallet_currency", "ledger_currency"],
  userId: ["operator_key", "member_ref", "workspace_user", "access_subject", "merchant_user"],
  email: ["operator_mail", "member_mail", "access_email", "workspace_inbox", "user_contact"],
  displayName: ["operator_name", "member_label", "workspace_name", "access_name", "merchant_label"],
  authEmail: ["access_mail", "sign_in_mail", "member_email", "operator_email", "workspace_email"],
  authPassword: ["access_phrase", "sign_in_secret", "member_secret", "operator_phrase", "workspace_secret"],
  authDisplayName: ["access_label", "operator_title", "member_name", "workspace_title", "business_label"],
  authCurrency: ["home_unit", "settlement_unit", "workspace_currency", "ledger_unit", "account_currency"]
};

const ENDPOINT_ALIAS_VARIANTS: Record<string, readonly string[]> = {
  account: ["me", "profile", "workspace", "merchant", "wallet"],
  appShell: ["merchant-entry", "workspace-entry", "portal-start", "gateway-shell", "account-entry"],
  balances: ["balances", "float", "available", "cashbox", "treasury"],
  metrics: ["summary", "signals", "totals", "activity", "pulse"],
  overview: ["merchant-overview", "workspace-summary", "gateway-board", "account-home", "ops-console"],
  register: ["open-workspace", "create-access", "start-profile", "join-console", "activate-desk"],
  login: ["resume-workspace", "enter-console", "restore-access", "open-session", "return-desk"],
  payments: ["settlement-ledger", "checkout-activity", "case-timeline", "movement-book", "payment-desk"],
  customers: ["payer-profiles", "client-book", "buyer-list", "counterparty-file", "customer-desk"],
  paymentMethods: ["funding-sources", "instrument-vault", "payment-rails", "source-wallet", "method-library"],
  paymentIntents: ["routing-drafts", "authorization-queue", "payment-plans", "intent-board", "flow-drafts"],
  balanceTransactions: ["ledger-movements", "balance-postings", "treasury-feed", "settlement-lines", "account-events"],
  config: ["interface-hints", "runtime-hints", "workspace-hints", "portal-hints", "surface-hints"]
};

function publicEndpointAlias(endpoint: string): string {
  return endpoint.split("/").at(-1) ?? endpoint;
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
