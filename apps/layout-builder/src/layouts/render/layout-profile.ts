import type { LayoutBuilderLayoutVariant } from "@payment-ops/shared-types";
import { createHash } from "node:crypto";

export type PaymentColumnKey =
  | "transactionId"
  | "status"
  | "requestedAmount"
  | "paidAmount"
  | "createdAt"
  | "paidAt"
  | "type"
  | "method";

export interface PaymentColumnProfile {
  key: PaymentColumnKey;
  label: string;
  x: number;
  width: number;
}

export interface LayoutProfile {
  variant: LayoutBuilderLayoutVariant;
  titleX: number;
  titleY: number;
  balanceX: number;
  balanceY: number;
  searchX: number;
  searchY: number;
  filterStartX: number;
  filterStartY: number;
  filterStepX: number;
  actionStartX: number;
  actionY: number;
  paymentsTitleX: number;
  paymentsTitleY: number;
  tableTop: number;
  tableX: number;
  tableWidth: number;
  rowHeight: number;
  headerLabelWeight: number;
  statusStyle: "pill" | "dot" | "outline";
  columns: PaymentColumnProfile[];
}

const CLASSIC_COLUMNS: PaymentColumnProfile[] = [
  { key: "transactionId", label: "Transaction ID", x: 72, width: 184 },
  { key: "status", label: "Status", x: 256, width: 132 },
  { key: "requestedAmount", label: "Requested", x: 388, width: 140 },
  { key: "paidAmount", label: "Paid", x: 528, width: 140 },
  { key: "createdAt", label: "Created", x: 668, width: 144 },
  { key: "paidAt", label: "Paid time", x: 812, width: 144 },
  { key: "type", label: "Type", x: 956, width: 84 },
  { key: "method", label: "Method", x: 1040, width: 86 }
];

const SUMMARY_LEFT_COLUMNS: PaymentColumnProfile[] = [
  { key: "status", label: "State", x: 72, width: 126 },
  { key: "transactionId", label: "Payment ref", x: 198, width: 188 },
  { key: "method", label: "Rail", x: 386, width: 94 },
  { key: "type", label: "Flow", x: 480, width: 96 },
  { key: "requestedAmount", label: "Ask", x: 576, width: 128 },
  { key: "paidAmount", label: "Collected", x: 704, width: 138 },
  { key: "paidAt", label: "Settled", x: 842, width: 144 },
  { key: "createdAt", label: "Opened", x: 986, width: 122 }
];

const DENSE_OPS_COLUMNS: PaymentColumnProfile[] = [
  { key: "transactionId", label: "Txn", x: 72, width: 158 },
  { key: "method", label: "Method", x: 230, width: 102 },
  { key: "createdAt", label: "Created at", x: 332, width: 142 },
  { key: "status", label: "Result", x: 474, width: 124 },
  { key: "type", label: "Kind", x: 598, width: 88 },
  { key: "requestedAmount", label: "Request amt", x: 686, width: 136 },
  { key: "paidAmount", label: "Paid amt", x: 822, width: 130 },
  { key: "paidAt", label: "Paid at", x: 952, width: 154 }
];

export function createLayoutProfile(brandId: string): LayoutProfile {
  const seed = hashToNumber(brandId);
  const variant = (["classic", "summary-left", "dense-ops"] as const)[seed % 3]!;

  if (variant === "summary-left") {
    return {
      variant,
      titleX: 328,
      titleY: 150,
      balanceX: 54,
      balanceY: 122,
      searchX: 328,
      searchY: 204,
      filterStartX: 54,
      filterStartY: 286,
      filterStepX: 176,
      actionStartX: 54,
      actionY: 346,
      paymentsTitleX: 54,
      paymentsTitleY: 432,
      tableTop: 460,
      tableX: 54,
      tableWidth: 1072,
      rowHeight: 48,
      headerLabelWeight: 700,
      statusStyle: "dot",
      columns: SUMMARY_LEFT_COLUMNS
    };
  }

  if (variant === "dense-ops") {
    return {
      variant,
      titleX: 54,
      titleY: 136,
      balanceX: 896,
      balanceY: 112,
      searchX: 54,
      searchY: 176,
      filterStartX: 350,
      filterStartY: 176,
      filterStepX: 156,
      actionStartX: 54,
      actionY: 246,
      paymentsTitleX: 54,
      paymentsTitleY: 330,
      tableTop: 354,
      tableX: 54,
      tableWidth: 1072,
      rowHeight: 42,
      headerLabelWeight: 780,
      statusStyle: "outline",
      columns: DENSE_OPS_COLUMNS
    };
  }

  return {
    variant,
    titleX: 54,
    titleY: 150,
    balanceX: 900,
    balanceY: 122,
    searchX: 54,
    searchY: 205,
    filterStartX: 350,
    filterStartY: 205,
    filterStepX: 176,
    actionStartX: 54,
    actionY: 282,
    paymentsTitleX: 54,
    paymentsTitleY: 365,
    tableTop: 392,
    tableX: 54,
    tableWidth: 1072,
    rowHeight: 46,
    headerLabelWeight: 760,
    statusStyle: "pill",
    columns: CLASSIC_COLUMNS
  };
}

function hashToNumber(value: string): number {
  return Number.parseInt(createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
}
