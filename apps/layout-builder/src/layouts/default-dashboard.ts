import type { LayoutBuilderDashboardConfig } from "@payment-ops/shared-types";

const STATUS_SEQUENCE: Array<LayoutBuilderDashboardConfig["payments"][number]["status"]> = [
  "paid",
  "pending",
  "created",
  "failed",
  "refunded"
];
const CURRENCIES = ["USD", "EUR", "INR", "BRL"];

export function createDefaultDashboardConfig(
  brandName: string,
  seedKey = "default-dashboard"
): LayoutBuilderDashboardConfig {
  const random = seededRandom(`${seedKey}:${brandName}`);
  const currency = pick(CURRENCIES, random);
  const rowCount = 4 + Math.floor(random() * 5);
  const baseDate = new Date("2026-05-15T12:00:00.000Z");
  const payments = Array.from({ length: rowCount }, (_, index) => {
    const status = STATUS_SEQUENCE[(index + Math.floor(random() * STATUS_SEQUENCE.length)) % STATUS_SEQUENCE.length]!;
    const requestedAmount = money(90 + random() * 2400);
    const paidAmount = status === "paid" || status === "refunded" ? requestedAmount : status === "pending" ? 0 : money(requestedAmount * random());
    const createdAt = new Date(baseDate.getTime() - (index * 63 + Math.floor(random() * 36)) * 60 * 1000);
    const paidAt =
      status === "paid" || status === "refunded"
        ? new Date(createdAt.getTime() + (5 + Math.floor(random() * 320)) * 1000).toISOString()
        : null;
    const transactionId = `${brandName
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "")
      .slice(0, 5) || "brand"}_${Math.floor(100000 + random() * 899999)}`;

    return {
      transactionId,
      status,
      requestedAmount,
      paidAmount,
      createdAt: createdAt.toISOString(),
      paidAt
    };
  });
  const balance = money(payments.reduce((sum, payment) => sum + payment.paidAmount, 0) + random() * 50000);

  return {
    title: `${brandName} Payments`,
    balance,
    currency,
    pageSize: rowCount,
    payments
  };
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;

  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)]!;
}

function money(value: number): number {
  return Math.round(value * 100) / 100;
}
