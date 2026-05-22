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

export type PaymentCoreBalanceTransactionType =
  | "payment_capture"
  | "payment_settlement"
  | "refund"
  | "adjustment";

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

export interface PaymentCoreCustomer {
  customerId: string;
  brandId: string;
  accountId: string;
  userId: string;
  email: string | null;
  name: string;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCorePaymentMethod {
  paymentMethodId: string;
  brandId: string;
  accountId: string;
  customerId: string | null;
  type: PaymentCoreMethodType;
  label: string;
  last4: string | null;
  brand: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  bankName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCorePaymentIntent {
  paymentIntentId: string;
  externalReference: string;
  brandId: string;
  accountId: string;
  userId: string;
  customerId: string | null;
  paymentMethodId: string | null;
  status: PaymentCoreStatus;
  amount: number;
  currency: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentCoreBalanceTransaction {
  balanceTransactionId: string;
  brandId: string;
  accountId: string;
  paymentId: string | null;
  type: PaymentCoreBalanceTransactionType;
  amount: number;
  currency: string;
  description: string;
  availableAt: string | null;
  createdAt: string;
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
  customerId: string | null;
  paymentMethodId: string | null;
  paymentIntentId: string | null;
  status: PaymentCoreStatus;
  amount: number;
  currency: string;
  payerLabel: string;
  destinationLabel: string;
  methodType: PaymentCoreMethodType;
  customer: PaymentCoreCustomer | null;
  paymentMethod: PaymentCorePaymentMethod | null;
  paymentIntent: PaymentCorePaymentIntent | null;
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
  customers: PaymentCoreCustomer[];
  paymentMethods: PaymentCorePaymentMethod[];
  balanceTransactions: PaymentCoreBalanceTransaction[];
}

export interface PaymentCoreCreatePaymentRequest {
  amount: number;
  currency?: string;
  destinationLabel?: string;
  methodType?: PaymentCoreMethodType;
  customer?: {
    customerId?: string;
    email?: string;
    name: string;
    phone?: string;
  };
  paymentMethod?: {
    paymentMethodId?: string;
    type?: PaymentCoreMethodType;
    label?: string;
    last4?: string;
    brand?: string;
    expiryMonth?: number;
    expiryYear?: number;
    bankName?: string;
  };
  description?: string;
  scenario?: "demo" | "requires_action" | "fail" | "review" | "reserve" | "settle" | "refund";
}

export interface PaymentCoreCreatePaymentResponse {
  payment: PaymentCorePayment;
  events: PaymentCorePaymentEvent[];
}
