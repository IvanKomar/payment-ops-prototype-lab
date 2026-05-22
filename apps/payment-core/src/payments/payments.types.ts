import type {
  PaymentCoreAccount,
  PaymentCoreBalanceTransactionType,
  PaymentCoreBalanceTransaction,
  PaymentCoreCustomer,
  PaymentCoreMethodType,
  PaymentCorePayment,
  PaymentCorePaymentEvent,
  PaymentCorePaymentIntent,
  PaymentCorePaymentMethod,
  PaymentCoreStatus,
  PaymentCoreUser
} from "@payment-ops/shared-types";
import type {
  BalanceTransaction,
  Payment,
  PaymentAccount,
  PaymentCustomer,
  PaymentEvent,
  PaymentIntent,
  PaymentMethod,
  PaymentUser
} from "@prisma/client";

type PaymentWithGatewayRelations = Payment & {
  customer?: PaymentCustomer | null;
  paymentIntent?: PaymentIntent | null;
  paymentMethod?: PaymentMethod | null;
};

export interface AuthenticatedPaymentUser {
  user: PaymentUser;
  account: PaymentAccount;
}

export function toUserResponse(user: PaymentUser): PaymentCoreUser {
  return {
    userId: user.id,
    brandId: user.brandId,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export function toAccountResponse(account: PaymentAccount): PaymentCoreAccount {
  return {
    accountId: account.id,
    brandId: account.brandId,
    userId: account.userId,
    balance: account.balance,
    currency: account.currency,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString()
  };
}

export function toCustomerResponse(customer: PaymentCustomer): PaymentCoreCustomer {
  return {
    customerId: customer.id,
    brandId: customer.brandId,
    accountId: customer.accountId,
    userId: customer.userId,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString()
  };
}

export function toPaymentMethodResponse(method: PaymentMethod): PaymentCorePaymentMethod {
  return {
    paymentMethodId: method.id,
    brandId: method.brandId,
    accountId: method.accountId,
    customerId: method.customerId,
    type: method.type as PaymentCoreMethodType,
    label: method.label,
    last4: method.last4,
    brand: method.brand,
    expiryMonth: method.expiryMonth,
    expiryYear: method.expiryYear,
    bankName: method.bankName,
    createdAt: method.createdAt.toISOString(),
    updatedAt: method.updatedAt.toISOString()
  };
}

export function toPaymentIntentResponse(intent: PaymentIntent): PaymentCorePaymentIntent {
  return {
    paymentIntentId: intent.id,
    externalReference: intent.externalReference,
    brandId: intent.brandId,
    accountId: intent.accountId,
    userId: intent.userId,
    customerId: intent.customerId,
    paymentMethodId: intent.paymentMethodId,
    status: intent.status as PaymentCoreStatus,
    amount: intent.amount,
    currency: intent.currency,
    description: intent.description,
    createdAt: intent.createdAt.toISOString(),
    updatedAt: intent.updatedAt.toISOString()
  };
}

export function toBalanceTransactionResponse(transaction: BalanceTransaction): PaymentCoreBalanceTransaction {
  return {
    balanceTransactionId: transaction.id,
    brandId: transaction.brandId,
    accountId: transaction.accountId,
    paymentId: transaction.paymentId,
    type: transaction.type as PaymentCoreBalanceTransactionType,
    amount: transaction.amount,
    currency: transaction.currency,
    description: transaction.description,
    availableAt: transaction.availableAt?.toISOString() ?? null,
    createdAt: transaction.createdAt.toISOString()
  };
}

export function toPaymentResponse(payment: PaymentWithGatewayRelations): PaymentCorePayment {
  return {
    paymentId: payment.id,
    externalReference: payment.externalReference,
    brandId: payment.brandId,
    accountId: payment.accountId,
    userId: payment.userId,
    customerId: payment.customerId,
    paymentMethodId: payment.paymentMethodId,
    paymentIntentId: payment.paymentIntentId,
    status: payment.status as PaymentCoreStatus,
    amount: payment.amount,
    currency: payment.currency,
    payerLabel: payment.payerLabel,
    destinationLabel: payment.destinationLabel,
    methodType: payment.methodType as PaymentCoreMethodType,
    customer: payment.customer ? toCustomerResponse(payment.customer) : null,
    paymentMethod: payment.paymentMethod ? toPaymentMethodResponse(payment.paymentMethod) : null,
    paymentIntent: payment.paymentIntent ? toPaymentIntentResponse(payment.paymentIntent) : null,
    provider: payment.provider,
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    authorizedAt: payment.authorizedAt?.toISOString() ?? null,
    capturedAt: payment.capturedAt?.toISOString() ?? null,
    settledAt: payment.settledAt?.toISOString() ?? null,
    refundedAt: payment.refundedAt?.toISOString() ?? null,
    failureCode: payment.failureCode
  };
}

export function toPaymentEventResponse(event: PaymentEvent): PaymentCorePaymentEvent {
  return {
    eventId: event.id,
    paymentId: event.paymentId,
    fromStatus: event.fromStatus as PaymentCoreStatus | null,
    toStatus: event.toStatus as PaymentCoreStatus,
    reason: event.reason,
    createdAt: event.createdAt.toISOString()
  };
}
