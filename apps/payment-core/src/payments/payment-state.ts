import type { PaymentCoreStatus } from "@payment-ops/shared-types";

const TERMINAL_STATUSES = new Set<PaymentCoreStatus>(["settled", "failed", "canceled", "refunded"]);

const ALLOWED_TRANSITIONS: Record<PaymentCoreStatus, PaymentCoreStatus[]> = {
  created: ["requires_payment_method", "requires_confirmation", "processing", "canceled", "failed"],
  requires_payment_method: ["requires_confirmation", "canceled", "failed"],
  requires_confirmation: ["processing", "canceled", "failed"],
  processing: ["authorized", "captured", "settled", "failed"],
  authorized: ["captured", "canceled", "refunded"],
  captured: ["settled", "refunded"],
  settled: ["refunded"],
  failed: [],
  canceled: [],
  refunded: []
};

export function canTransition(from: PaymentCoreStatus, to: PaymentCoreStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertPaymentTransition(from: PaymentCoreStatus, to: PaymentCoreStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid payment transition: ${from} -> ${to}`);
  }
}

export function isTerminalPaymentStatus(status: PaymentCoreStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

export function initialStatusForScenario(input: {
  paymentId: string;
  destinationLabel: string;
  scenario?: string;
}): PaymentCoreStatus {
  const scenario = input.scenario ?? scenarioFromDestination(input.destinationLabel);
  const explicitStatus = paymentStatusValue(scenario);

  if (explicitStatus) {
    return explicitStatus;
  }

  if (scenario === "fail") {
    return "failed";
  }

  if (scenario === "review" || scenario === "requires_action") {
    return "processing";
  }

  if (scenario === "reserve") {
    return "authorized";
  }

  if (scenario === "settle") {
    return "settled";
  }

  if (scenario === "refund") {
    return "refunded";
  }

  return stableDemoStatus(input.paymentId);
}

function paymentStatusValue(value: string): PaymentCoreStatus | null {
  const statuses: PaymentCoreStatus[] = [
    "created",
    "requires_payment_method",
    "requires_confirmation",
    "processing",
    "authorized",
    "captured",
    "settled",
    "failed",
    "canceled",
    "refunded"
  ];

  return statuses.includes(value as PaymentCoreStatus) ? (value as PaymentCoreStatus) : null;
}

function scenarioFromDestination(destinationLabel: string): string {
  const normalized = destinationLabel.toLowerCase();

  if (normalized.includes("fail")) {
    return "fail";
  }

  if (normalized.includes("review")) {
    return "review";
  }

  if (normalized.includes("reserve") || normalized.includes("auth")) {
    return "reserve";
  }

  if (normalized.includes("settle")) {
    return "settle";
  }

  if (normalized.includes("refund")) {
    return "refund";
  }

  return "demo";
}

function stableDemoStatus(paymentId: string): PaymentCoreStatus {
  const statuses: PaymentCoreStatus[] = [
    "created",
    "requires_payment_method",
    "requires_confirmation",
    "processing",
    "authorized",
    "captured",
    "settled"
  ];
  const sum = [...paymentId].reduce((value, char) => value + char.charCodeAt(0), 0);

  return statuses[sum % statuses.length]!;
}
