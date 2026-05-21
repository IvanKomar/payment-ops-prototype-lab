export type PaymentCoreStatus =
  | "created"
  | "requires_payment_method"
  | "requires_confirmation"
  | "processing"
  | "authorized"
  | "captured"
  | "settled"
  | "failed"
  | "canceled"
  | "refunded";

export type PaymentCoreMethodType = "card" | "bank_transfer" | "wallet" | "crypto" | "manual";

export interface PaymentCoreUser {
  userId: string;
  brandId: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCoreAccount {
  accountId: string;
  brandId: string;
  userId: string;
  balance: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCoreAuthResponse {
  sessionToken: string;
  user: PaymentCoreUser;
  account: PaymentCoreAccount;
}

export interface PaymentCorePayment {
  paymentId: string;
  externalReference: string;
  brandId: string;
  accountId: string;
  userId: string;
  status: PaymentCoreStatus;
  amount: number;
  currency: string;
  payerLabel: string;
  destinationLabel: string;
  methodType: PaymentCoreMethodType;
  provider: string;
  createdAt: string;
  updatedAt: string;
  authorizedAt: string | null;
  capturedAt: string | null;
  settledAt: string | null;
  refundedAt: string | null;
  failureCode: string | null;
}

export interface PaymentCorePaymentEvent {
  eventId: string;
  paymentId: string;
  fromStatus: PaymentCoreStatus | null;
  toStatus: PaymentCoreStatus;
  reason: string;
  createdAt: string;
}

export interface PaymentCoreHistoryResponse {
  account: PaymentCoreAccount;
  payments: PaymentCorePayment[];
}

export interface PaymentCoreCreatePaymentRequest {
  amount: number;
  currency?: string;
  destinationLabel: string;
  methodType?: PaymentCoreMethodType;
  scenario?: "demo" | "requires_action" | "fail" | "review" | "reserve" | "settle" | "refund";
}

export interface PaymentCoreCreatePaymentResponse {
  payment: PaymentCorePayment;
  events: PaymentCorePaymentEvent[];
}
