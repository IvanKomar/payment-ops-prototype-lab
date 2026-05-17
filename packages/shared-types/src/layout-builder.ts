export type LayoutBuilderFieldStyle = "camelCase" | "snake_case" | "kebab-case";
export type LayoutBuilderPayloadStructure = "flat" | "nested" | "key-value-array";
export type LayoutBuilderLayoutVariant = "classic" | "summary-left" | "dense-ops";

export interface LayoutBuilderPalette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
}

export interface LayoutBuilderPaymentRow {
  transactionId: string;
  status: "created" | "pending" | "paid" | "failed" | "refunded";
  requestedAmount: number;
  paidAmount: number;
  createdAt: string;
  paidAt: string | null;
  type: "p2p" | "intent" | "refund";
  method: string;
}

export interface LayoutBuilderDashboardConfig {
  title: string;
  balance: number;
  currency: string;
  mode: "P2P" | "INTENT";
  searchTransactionId: string;
  filters: {
    method: string;
    type: string;
    status: string;
    dateFrom: string;
    dateTo: string;
  };
  pageSize: number;
  payments: LayoutBuilderPaymentRow[];
}

export interface LayoutBuilderSchemaField {
  canonical: string;
  external: string;
}

export interface LayoutBuilderBrandSchemaResponse {
  brandId: string;
  schemaId: string;
  endpoint: string;
  method: "POST";
  methods: Array<"GET" | "POST">;
  fieldsStyle: LayoutBuilderFieldStyle;
  structure: LayoutBuilderPayloadStructure;
  layoutVariant: LayoutBuilderLayoutVariant;
  fields: Record<string, string>;
  samplePayload: unknown;
}

export interface LayoutBuilderBrandResponse extends LayoutBuilderBrandSchemaResponse {
  name: string;
  logoMimeType: string;
  palette: LayoutBuilderPalette;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderBrandListItem {
  brandId: string;
  name: string;
  logoMimeType: string;
  palette: LayoutBuilderPalette;
  createdAt: string;
  updatedAt: string;
}

export interface LayoutBuilderConfigureResponse {
  requestId: string;
  brandId: string;
  layoutUrl: string;
  data: unknown;
}

export interface LayoutBuilderDeleteBrandResponse {
  brandId: string;
  deleted: true;
}
