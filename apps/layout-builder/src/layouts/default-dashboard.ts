import type { LayoutBuilderDashboardConfig } from "@payment-ops/shared-types";

export function createDefaultDashboardConfig(brandName: string): LayoutBuilderDashboardConfig {
  return {
    title: `${brandName} Payments`,
    balance: 128420.75,
    currency: "USD",
    mode: "P2P",
    searchTransactionId: "txn_10291",
    filters: {
      method: "All methods",
      type: "All types",
      status: "All statuses",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-15"
    },
    pageSize: 10,
    payments: [
      {
        transactionId: "txn_10291",
        status: "paid",
        requestedAmount: 1499,
        paidAmount: 1499,
        createdAt: "2026-05-15T09:12:00.000Z",
        paidAt: "2026-05-15T09:12:18.000Z",
        type: "p2p",
        method: "UPI"
      },
      {
        transactionId: "txn_10290",
        status: "pending",
        requestedAmount: 249,
        paidAmount: 0,
        createdAt: "2026-05-15T08:50:00.000Z",
        paidAt: null,
        type: "intent",
        method: "Card"
      },
      {
        transactionId: "txn_10289",
        status: "failed",
        requestedAmount: 720,
        paidAmount: 0,
        createdAt: "2026-05-14T17:22:00.000Z",
        paidAt: null,
        type: "p2p",
        method: "Bank"
      },
      {
        transactionId: "txn_10288",
        status: "refunded",
        requestedAmount: 340,
        paidAmount: 340,
        createdAt: "2026-05-14T12:05:00.000Z",
        paidAt: "2026-05-14T12:05:21.000Z",
        type: "refund",
        method: "Wallet"
      }
    ]
  };
}
