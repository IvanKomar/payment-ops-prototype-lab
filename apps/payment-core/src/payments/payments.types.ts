import type {
  PaymentCoreAccount,
  PaymentCoreMethodType,
  PaymentCorePayment,
  PaymentCorePaymentEvent,
  PaymentCoreStatus,
  PaymentCoreUser
} from "@payment-ops/shared-types";
import type { Payment, PaymentAccount, PaymentEvent, PaymentUser } from "@prisma/client";

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

export function toPaymentResponse(payment: Payment): PaymentCorePayment {
  return {
    paymentId: payment.id,
    externalReference: payment.externalReference,
    brandId: payment.brandId,
    accountId: payment.accountId,
    userId: payment.userId,
    status: payment.status as PaymentCoreStatus,
    amount: payment.amount,
    currency: payment.currency,
    payerLabel: payment.payerLabel,
    destinationLabel: payment.destinationLabel,
    methodType: payment.methodType as PaymentCoreMethodType,
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
