import type { LayoutBuilderLayoutVariant } from "@payment-ops/shared-types";
import { createHash } from "node:crypto";

export type PaymentColumnKey =
  | "transactionId"
  | "status"
  | "requestedAmount"
  | "paidAmount"
  | "createdAt"
  | "paidAt";

export interface PaymentColumnProfile {
  key: PaymentColumnKey;
  label: string;
  x: number;
  width: number;
}

export interface LayoutProfile {
  templateId: string;
  variant: LayoutBuilderLayoutVariant;
  labelSet: string;
  navStyle: "side" | "top" | "rail";
  metricLayout: "cards" | "strip" | "split";
  filterLayout: "toolbar" | "chips" | "rail";
  tableDensity: "compact" | "regular" | "spacious";
  tableTitle: string;
  balanceLabel: string;
  searchLabel: string;
  actionLabels: string[];
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

const VARIANTS: LayoutBuilderLayoutVariant[] = [
  "classic",
  "summary-left",
  "dense-ops",
  "command-center",
  "finance-ledger",
  "compact-review"
];

const LABEL_SETS = [
  {
    id: "payments",
    tableTitle: "Payments",
    balanceLabel: "Balance",
    searchLabel: "Search",
    labels: {
      transactionId: "Transaction ID",
      status: "Status",
      requestedAmount: "Requested",
      paidAmount: "Paid",
      createdAt: "Created",
      paidAt: "Paid time"
    }
  },
  {
    id: "ops",
    tableTitle: "Payment operations",
    balanceLabel: "Available balance",
    searchLabel: "Find ref",
    labels: {
      transactionId: "Payment ref",
      status: "State",
      requestedAmount: "Ask",
      paidAmount: "Collected",
      createdAt: "Opened",
      paidAt: "Settled"
    }
  },
  {
    id: "ledger",
    tableTitle: "Ledger entries",
    balanceLabel: "Ledger total",
    searchLabel: "Lookup",
    labels: {
      transactionId: "Ledger ID",
      status: "Lifecycle",
      requestedAmount: "Debit",
      paidAmount: "Credit",
      createdAt: "Booked",
      paidAt: "Cleared"
    }
  },
  {
    id: "checkout",
    tableTitle: "Checkout activity",
    balanceLabel: "Net balance",
    searchLabel: "Order search",
    labels: {
      transactionId: "Order",
      status: "Result",
      requestedAmount: "Order value",
      paidAmount: "Captured",
      createdAt: "Started",
      paidAt: "Captured at"
    }
  },
  {
    id: "settlement",
    tableTitle: "Settlement queue",
    balanceLabel: "Settlement balance",
    searchLabel: "Trace",
    labels: {
      transactionId: "Trace ID",
      status: "Outcome",
      requestedAmount: "Expected",
      paidAmount: "Settled",
      createdAt: "Queued",
      paidAt: "Closed"
    }
  },
  {
    id: "risk",
    tableTitle: "Review stream",
    balanceLabel: "Exposure",
    searchLabel: "Case search",
    labels: {
      transactionId: "Case",
      status: "Decision",
      requestedAmount: "Requested",
      paidAmount: "Released",
      createdAt: "Raised",
      paidAt: "Resolved"
    }
  }
] satisfies Array<{
  id: string;
  tableTitle: string;
  balanceLabel: string;
  searchLabel: string;
  labels: Record<PaymentColumnKey, string>;
}>;

const COLUMN_ORDERS: PaymentColumnKey[][] = [
  ["transactionId", "status", "requestedAmount", "paidAmount", "createdAt", "paidAt"],
  ["status", "transactionId", "requestedAmount", "paidAmount", "paidAt", "createdAt"],
  ["transactionId", "createdAt", "status", "requestedAmount", "paidAmount", "paidAt"],
  ["createdAt", "transactionId", "status", "paidAmount", "requestedAmount"],
  ["transactionId", "status", "requestedAmount", "paidAmount", "createdAt"],
  ["transactionId", "paidAmount", "requestedAmount", "status", "paidAt", "createdAt"]
];

const COLUMN_WIDTHS: Record<PaymentColumnKey, number> = {
  transactionId: 178,
  status: 128,
  requestedAmount: 132,
  paidAmount: 128,
  createdAt: 136,
  paidAt: 136
};

export function createLayoutProfile(
  brandId: string,
  recentProfiles: readonly LayoutProfile[] = []
): LayoutProfile {
  const candidates = Array.from({ length: 18 }, (_, attempt) => createCandidateProfile(brandId, attempt));

  if (recentProfiles.length === 0) {
    return candidates[0]!;
  }

  return candidates
    .map((candidate) => ({
      candidate,
      score: Math.min(...recentProfiles.slice(0, 6).map((recent) => profileDistance(candidate, recent)))
    }))
    .sort((left, right) => right.score - left.score || left.candidate.templateId.localeCompare(right.candidate.templateId))[0]!
    .candidate;
}

function createCandidateProfile(brandId: string, attempt: number): LayoutProfile {
  const seed = hashToNumber(`${brandId}:${attempt}`);
  const variant = VARIANTS[seed % VARIANTS.length]!;
  const labelSet = LABEL_SETS[Math.floor(seed / 7) % LABEL_SETS.length]!;
  const order = COLUMN_ORDERS[Math.floor(seed / 13) % COLUMN_ORDERS.length]!;
  const columns = createColumns(order, labelSet.labels);
  const statusStyle = (["pill", "dot", "outline"] as const)[Math.floor(seed / 17) % 3]!;
  const tableDensity = (["compact", "regular", "spacious"] as const)[Math.floor(seed / 19) % 3]!;
  const rowHeight = tableDensity === "compact" ? 40 : tableDensity === "spacious" ? 52 : 46;
  const actionLabels = actionLabelSet(Math.floor(seed / 23));

  if (variant === "summary-left") {
    return {
      templateId: `summary-left:${labelSet.id}:${order.join(",")}:${statusStyle}:${tableDensity}`,
      variant,
      labelSet: labelSet.id,
      navStyle: "side",
      metricLayout: "split",
      filterLayout: "rail",
      tableDensity,
      tableTitle: labelSet.tableTitle,
      balanceLabel: labelSet.balanceLabel,
      searchLabel: labelSet.searchLabel,
      actionLabels,
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
      rowHeight,
      headerLabelWeight: 700,
      statusStyle,
      columns
    };
  }

  if (variant === "dense-ops") {
    return {
      templateId: `dense-ops:${labelSet.id}:${order.join(",")}:${statusStyle}:${tableDensity}`,
      variant,
      labelSet: labelSet.id,
      navStyle: "top",
      metricLayout: "strip",
      filterLayout: "toolbar",
      tableDensity,
      tableTitle: labelSet.tableTitle,
      balanceLabel: labelSet.balanceLabel,
      searchLabel: labelSet.searchLabel,
      actionLabels,
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
      rowHeight,
      headerLabelWeight: 780,
      statusStyle,
      columns
    };
  }

  if (variant === "command-center") {
    return {
      templateId: `command-center:${labelSet.id}:${order.join(",")}:${statusStyle}:${tableDensity}`,
      variant,
      labelSet: labelSet.id,
      navStyle: "top",
      metricLayout: "cards",
      filterLayout: "chips",
      tableDensity,
      tableTitle: labelSet.tableTitle,
      balanceLabel: labelSet.balanceLabel,
      searchLabel: labelSet.searchLabel,
      actionLabels,
      titleX: 54,
      titleY: 142,
      balanceX: 54,
      balanceY: 176,
      searchX: 328,
      searchY: 176,
      filterStartX: 54,
      filterStartY: 254,
      filterStepX: 174,
      actionStartX: 760,
      actionY: 176,
      paymentsTitleX: 54,
      paymentsTitleY: 342,
      tableTop: 370,
      tableX: 54,
      tableWidth: 1072,
      rowHeight,
      headerLabelWeight: 740,
      statusStyle,
      columns
    };
  }

  if (variant === "finance-ledger") {
    return {
      templateId: `finance-ledger:${labelSet.id}:${order.join(",")}:${statusStyle}:${tableDensity}`,
      variant,
      labelSet: labelSet.id,
      navStyle: "rail",
      metricLayout: "split",
      filterLayout: "toolbar",
      tableDensity,
      tableTitle: labelSet.tableTitle,
      balanceLabel: labelSet.balanceLabel,
      searchLabel: labelSet.searchLabel,
      actionLabels,
      titleX: 54,
      titleY: 128,
      balanceX: 54,
      balanceY: 168,
      searchX: 54,
      searchY: 246,
      filterStartX: 350,
      filterStartY: 246,
      filterStepX: 150,
      actionStartX: 830,
      actionY: 168,
      paymentsTitleX: 54,
      paymentsTitleY: 336,
      tableTop: 362,
      tableX: 54,
      tableWidth: 1072,
      rowHeight,
      headerLabelWeight: 700,
      statusStyle,
      columns
    };
  }

  if (variant === "compact-review") {
    return {
      templateId: `compact-review:${labelSet.id}:${order.join(",")}:${statusStyle}:${tableDensity}`,
      variant,
      labelSet: labelSet.id,
      navStyle: "side",
      metricLayout: "strip",
      filterLayout: "chips",
      tableDensity,
      tableTitle: labelSet.tableTitle,
      balanceLabel: labelSet.balanceLabel,
      searchLabel: labelSet.searchLabel,
      actionLabels,
      titleX: 54,
      titleY: 128,
      balanceX: 910,
      balanceY: 112,
      searchX: 54,
      searchY: 172,
      filterStartX: 54,
      filterStartY: 232,
      filterStepX: 162,
      actionStartX: 708,
      actionY: 172,
      paymentsTitleX: 54,
      paymentsTitleY: 314,
      tableTop: 340,
      tableX: 54,
      tableWidth: 1072,
      rowHeight,
      headerLabelWeight: 780,
      statusStyle,
      columns
    };
  }

  return {
    templateId: `classic:${labelSet.id}:${order.join(",")}:${statusStyle}:${tableDensity}`,
    variant,
    labelSet: labelSet.id,
    navStyle: "side",
    metricLayout: "cards",
    filterLayout: "toolbar",
    tableDensity,
    tableTitle: labelSet.tableTitle,
    balanceLabel: labelSet.balanceLabel,
    searchLabel: labelSet.searchLabel,
    actionLabels,
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
    rowHeight,
    headerLabelWeight: 760,
    statusStyle,
    columns
  };
}

function createColumns(
  order: readonly PaymentColumnKey[],
  labels: Record<PaymentColumnKey, string>
): PaymentColumnProfile[] {
  let x = 72;

  return order.map((key) => {
    const column = {
      key,
      label: labels[key],
      x,
      width: COLUMN_WIDTHS[key]
    };
    x += column.width;
    return column;
  });
}

function actionLabelSet(seed: number): string[] {
  const sets = [
    ["Refresh", "Export", "Reconcile"],
    ["Sync", "Download CSV", "Report"],
    ["Reload", "Finance CSV", "Support"],
    ["Update", "Ledger export", "Flag review"],
    ["Pull latest", "Statement", "Audit log"]
  ];

  return sets[seed % sets.length]!;
}

function profileDistance(left: LayoutProfile, right: LayoutProfile): number {
  let score = 0;
  score += left.variant === right.variant ? 0 : 5;
  score += left.labelSet === right.labelSet ? 0 : 4;
  score += left.navStyle === right.navStyle ? 0 : 2;
  score += left.metricLayout === right.metricLayout ? 0 : 2;
  score += left.filterLayout === right.filterLayout ? 0 : 2;
  score += left.statusStyle === right.statusStyle ? 0 : 2;
  score += left.tableDensity === right.tableDensity ? 0 : 1;
  score += columnDistance(left.columns, right.columns);

  return score;
}

function columnDistance(left: readonly PaymentColumnProfile[], right: readonly PaymentColumnProfile[]): number {
  const rightPositions = new Map(right.map((column, index) => [column.key, index]));
  return left.reduce((score, column, index) => {
    const rightIndex = rightPositions.get(column.key);
    const labelChanged = column.label !== right.find((rightColumn) => rightColumn.key === column.key)?.label;
    return score + (rightIndex === index ? 0 : 0.75) + (labelChanged ? 0.5 : 0);
  }, 0);
}

function hashToNumber(value: string): number {
  return Number.parseInt(createHash("sha1").update(value).digest("hex").slice(0, 8), 16);
}
